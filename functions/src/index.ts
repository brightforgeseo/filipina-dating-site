import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { Translate } from '@google-cloud/translate/build/src/v2';
import { algoliasearch } from 'algoliasearch';

admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Algolia search indexing. App id is a plain env var; the admin (write) key is
// a secret. If unset, the sync triggers below no-op (search stays disabled).
const ALGOLIA_ADMIN_KEY = defineSecret('ALGOLIA_ADMIN_KEY');
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID || '';

const SITE = 'https://filipinawest.com';

// Keep in sync with the client catalog in src/lib/wallet.ts.
const COIN_PACKAGES: Record<string, { coins: number; usdCents: number }> = {
  starter: { coins: 100, usdCents: 499 },
  plus: { coins: 550, usdCents: 1999 },
  max: { coins: 1200, usdCents: 3999 },
};

const GIFT_PRICES: Record<string, number> = {
  rose: 5,
  heart: 10,
  kiss: 25,
  crown: 50,
  diamond: 100,
  castle: 500,
};

// Creator payout economics — adjust freely; nothing client-side depends on it.
const PAYOUT_USD_PER_COIN = 0.025;
const MIN_PAYOUT_COINS = 1000;

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return uid;
}

// ---- Buy coins: create a Stripe Checkout session ----
export const createCoinCheckout = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const pkg = COIN_PACKAGES[String(req.data?.packageId)];
  if (!pkg) throw new HttpsError('invalid-argument', 'Unknown coin package.');

  const stripe = new Stripe(STRIPE_SECRET_KEY.value());
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: pkg.usdCents,
          product_data: { name: `FilWest Coins — ${pkg.coins}` },
        },
      },
    ],
    metadata: { uid, coins: String(pkg.coins) },
    success_url: `${SITE}/app/community?coins=success`,
    cancel_url: `${SITE}/app/community?coins=cancelled`,
  });
  return { url: session.url };
});

// ---- Stripe webhook: credit coins after a verified payment ----
export const stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers['stripe-signature'] as string,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (e) {
      res.status(400).send('Invalid signature');
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.uid;
      const coins = Number(session.metadata?.coins ?? 0);
      if (uid && coins > 0) {
        // Event-id doc makes crediting idempotent across webhook retries.
        const eventRef = db.collection('stripeEvents').doc(event.id);
        await db.runTransaction(async (tx) => {
          const seen = await tx.get(eventRef);
          if (seen.exists) return;
          tx.set(eventRef, { uid, coins, createdAt: admin.firestore.FieldValue.serverTimestamp() });
          tx.set(
            db.collection('wallets').doc(uid),
            {
              coins: admin.firestore.FieldValue.increment(coins),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          tx.set(db.collection('purchases').doc(), {
            uid,
            coins,
            usdCents: session.amount_total ?? 0,
            stripeSessionId: session.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
      }
    }
    res.status(200).send('ok');
  }
);

// ---- Send a paid gift: debit sender, credit the post author's earnings ----
export const sendPaidGift = onCall(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const postId = String(req.data?.postId ?? '');
  const giftType = String(req.data?.giftType ?? '');
  const price = GIFT_PRICES[giftType];
  if (!postId || !price) throw new HttpsError('invalid-argument', 'Unknown gift.');

  const postRef = db.collection('posts').doc(postId);
  const walletRef = db.collection('wallets').doc(uid);
  const senderRef = db.collection('profiles').doc(uid);

  await db.runTransaction(async (tx) => {
    const [post, wallet, sender] = await Promise.all([
      tx.get(postRef),
      tx.get(walletRef),
      tx.get(senderRef),
    ]);
    if (!post.exists) throw new HttpsError('not-found', 'Post not found.');
    const authorId = post.data()!.authorId as string;
    if (authorId === uid) throw new HttpsError('failed-precondition', 'self-gift');
    const coins = (wallet.data()?.coins as number | undefined) ?? 0;
    if (coins < price) throw new HttpsError('failed-precondition', 'insufficient-coins');

    tx.update(walletRef, {
      coins: admin.firestore.FieldValue.increment(-price),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(
      db.collection('wallets').doc(authorId),
      {
        earned: admin.firestore.FieldValue.increment(price),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.set(postRef.collection('gifts').doc(), {
      senderId: uid,
      senderName: (sender.data()?.name as string | undefined) ?? 'Member',
      type: giftType,
      coins: price,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

// ---- Send a paid gift inside a live stream ----
export const sendStreamGift = onCall(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const streamId = String(req.data?.streamId ?? '');
  const giftType = String(req.data?.giftType ?? '');
  const price = GIFT_PRICES[giftType];
  if (!streamId || !price) throw new HttpsError('invalid-argument', 'Unknown gift.');

  const streamRef = db.collection('streams').doc(streamId);
  const walletRef = db.collection('wallets').doc(uid);
  const senderRef = db.collection('profiles').doc(uid);

  await db.runTransaction(async (tx) => {
    const [stream, wallet, sender] = await Promise.all([
      tx.get(streamRef),
      tx.get(walletRef),
      tx.get(senderRef),
    ]);
    if (!stream.exists || stream.data()!.status !== 'live') {
      throw new HttpsError('failed-precondition', 'stream-ended');
    }
    const hostId = stream.data()!.hostId as string;
    if (hostId === uid) throw new HttpsError('failed-precondition', 'self-gift');
    const coins = (wallet.data()?.coins as number | undefined) ?? 0;
    if (coins < price) throw new HttpsError('failed-precondition', 'insufficient-coins');
    const senderName = (sender.data()?.name as string | undefined) ?? 'Member';

    tx.update(walletRef, {
      coins: admin.firestore.FieldValue.increment(-price),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(
      db.collection('wallets').doc(hostId),
      {
        earned: admin.firestore.FieldValue.increment(price),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.set(streamRef.collection('gifts').doc(), {
      senderId: uid,
      senderName,
      type: giftType,
      coins: price,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Gift also lands in the stream chat so everyone sees the moment.
    tx.set(streamRef.collection('messages').doc(), {
      type: 'gift',
      senderId: uid,
      senderName,
      giftType,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

// ---- Send a paid gift directly to a member's profile ----
export const sendProfileGift = onCall(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const targetId = String(req.data?.targetId ?? '');
  const giftType = String(req.data?.giftType ?? '');
  const price = GIFT_PRICES[giftType];
  if (!targetId || !price) throw new HttpsError('invalid-argument', 'Unknown gift.');
  if (targetId === uid) throw new HttpsError('failed-precondition', 'self-gift');

  const walletRef = db.collection('wallets').doc(uid);
  const senderRef = db.collection('profiles').doc(uid);
  const targetRef = db.collection('profiles').doc(targetId);

  await db.runTransaction(async (tx) => {
    const [wallet, sender, target] = await Promise.all([
      tx.get(walletRef),
      tx.get(senderRef),
      tx.get(targetRef),
    ]);
    if (!target.exists) throw new HttpsError('not-found', 'Member not found.');
    const coins = (wallet.data()?.coins as number | undefined) ?? 0;
    if (coins < price) throw new HttpsError('failed-precondition', 'insufficient-coins');

    tx.update(walletRef, {
      coins: admin.firestore.FieldValue.increment(-price),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(
      db.collection('wallets').doc(targetId),
      {
        earned: admin.firestore.FieldValue.increment(price),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.set(targetRef.collection('gifts').doc(), {
      senderId: uid,
      senderName: (sender.data()?.name as string | undefined) ?? 'Member',
      type: giftType,
      coins: price,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

// ---- Request a payout of earned coins (fulfilled manually via GCash) ----
export const requestPayout = onCall(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const gcash = String(req.data?.gcash ?? '').trim();
  if (!/^(\+?63|0)9\d{9}$/.test(gcash.replace(/[\s-]/g, ''))) {
    throw new HttpsError('invalid-argument', 'invalid-gcash');
  }

  const walletRef = db.collection('wallets').doc(uid);
  const result = await db.runTransaction(async (tx) => {
    const wallet = await tx.get(walletRef);
    const earned = (wallet.data()?.earned as number | undefined) ?? 0;
    if (earned < MIN_PAYOUT_COINS) throw new HttpsError('failed-precondition', 'below-minimum');

    tx.update(walletRef, {
      earned: admin.firestore.FieldValue.increment(-earned),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(db.collection('payoutRequests').doc(), {
      userId: uid,
      coins: earned,
      usd: Math.round(earned * PAYOUT_USD_PER_COIN * 100) / 100,
      gcash,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return earned;
  });
  return { coins: result };
});

// ---- Activate a profile boost: debit coins, stamp profiles.boostedUntil ----
// Keep in sync with the client catalogs (src/lib/boost.ts and the app's
// utils/boost.ts). profiles.boostedUntil is admin-only at the rules layer, so
// a boost can only be granted here, after coins are actually spent.
const BOOST_PACKAGES: Record<string, { coins: number; minutes: number }> = {
  '30m': { coins: 50, minutes: 30 },
  '1h': { coins: 90, minutes: 60 },
  '3h': { coins: 200, minutes: 180 },
  '24h': { coins: 600, minutes: 1440 },
};

export const activateBoost = onCall(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const pkg = BOOST_PACKAGES[String(req.data?.packageId)];
  if (!pkg) throw new HttpsError('invalid-argument', 'Unknown boost package.');

  const walletRef = db.collection('wallets').doc(uid);
  const profileRef = db.collection('profiles').doc(uid);

  const until = await db.runTransaction(async (tx) => {
    const [wallet, profile] = await Promise.all([tx.get(walletRef), tx.get(profileRef)]);
    const coins = (wallet.data()?.coins as number | undefined) ?? 0;
    if (coins < pkg.coins) throw new HttpsError('failed-precondition', 'insufficient-coins');

    // Stack on top of any remaining boost time.
    const current = profile.data()?.boostedUntil as admin.firestore.Timestamp | undefined;
    const baseMs = current && current.toMillis() > Date.now() ? current.toMillis() : Date.now();
    const untilTs = admin.firestore.Timestamp.fromMillis(baseMs + pkg.minutes * 60_000);

    tx.update(walletRef, {
      coins: admin.firestore.FieldValue.increment(-pkg.coins),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(profileRef, { boostedUntil: untilTs }, { merge: true });
    tx.set(
      db.collection('boosts').doc(uid),
      {
        userId: uid,
        boostedUntil: untilTs,
        lastTier: String(req.data?.packageId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return untilTs;
  });

  return { boostedUntil: until.toMillis() };
});

// ---- Translate chat text (Google Cloud Translation) ----
// Uses Application Default Credentials — no API key in code. Requires the
// "Cloud Translation API" to be enabled on the project (see the deploy runbook).
const translate = new Translate();

export const translateText = onCall(async (req) => {
  requireAuth(req.auth?.uid);
  const text = String(req.data?.text ?? '').slice(0, 2000);
  const target = String(req.data?.target ?? 'en');
  if (!text.trim()) return { text: '' };
  try {
    const [out] = await translate.translate(text, target);
    return { text: out };
  } catch (e) {
    throw new HttpsError('internal', 'translate-failed');
  }
});

// ---- Automated content scanning: flag scam/abuse into the reports queue ----
// Server-side mirror of the web client's hasScamSignals patterns. On a hit, an
// auto-report (reporterId 'system', reason 'auto') is added for admin review.
const SCAM_PATTERNS: RegExp[] = [
  /\bg[\s-]?cash\b/i,
  /\bwestern\s*union\b/i,
  /\bmoney\s*gram\b/i,
  /\b(wire|bank)\s*transfer\b/i,
  /\bsend\s+(me\s+)?(money|cash|funds|load)\b/i,
  /\bpadala\b/i,
  /\bremittance\b/i,
  /\b(bitcoin|btc|crypto|usdt|binance)\b/i,
  /\b(gift|steam|itunes|google\s*play)\s*card\b/i,
  /\bpaypal\.me\b/i,
  /\bhospital\s*(bill|fee)\b/i,
  /\bemergency\b.*\b(money|cash|funds|help me pay)\b/i,
  /\b(visa|travel|ticket|passport)\s*(fee|money|payment)\b/i,
  /\b(whats\s*app|telegram|viber|signal)\b/i,
];
const scamHit = (text: string): boolean => SCAM_PATTERNS.some((re) => re.test(text));

async function flagContent(opts: {
  targetId: string;
  kind: 'post' | 'comment' | 'message';
  snippet: string;
  matchId?: string;
  postId?: string;
}): Promise<void> {
  if (!opts.targetId) return;
  await db.collection('reports').add({
    reporterId: 'system',
    targetId: opts.targetId,
    reason: 'auto',
    status: 'open',
    autoFlag: true,
    kind: opts.kind,
    snippet: opts.snippet.slice(0, 300),
    ...(opts.matchId ? { matchId: opts.matchId } : {}),
    ...(opts.postId ? { postId: opts.postId } : {}),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export const scanPost = onDocumentCreated('posts/{postId}', async (event) => {
  const p = event.data?.data();
  if (!p?.text || !scamHit(p.text)) return;
  await flagContent({ targetId: p.authorId, kind: 'post', snippet: p.text, postId: event.params.postId });
});

export const scanComment = onDocumentCreated('posts/{postId}/comments/{commentId}', async (event) => {
  const c = event.data?.data();
  if (!c?.text || !scamHit(c.text)) return;
  await flagContent({ targetId: c.authorId, kind: 'comment', snippet: c.text, postId: event.params.postId });
});

export const scanMessage = onDocumentCreated('matches/{matchId}/messages/{messageId}', async (event) => {
  const m = event.data?.data();
  if (!m?.text || !scamHit(m.text)) return;
  await flagContent({ targetId: m.senderId, kind: 'message', snippet: m.text, matchId: event.params.matchId });
});

// ---- On ban: tear down the banned user's content + 1:1 matches ----
async function deleteInBatches(refs: admin.firestore.DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += 450) {
    const batch = db.batch();
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

export const onUserBanned = onDocumentCreated('bans/{userId}', async (event) => {
  const userId = event.params.userId;
  try {
    // Remove their posts (syncPostIndex also drops them from search).
    const posts = await db.collection('posts').where('authorId', '==', userId).get();
    await deleteInBatches(posts.docs.map((d) => d.ref));

    // Tear down their matches + messages so the other side isn't left stuck.
    const [m1, m2] = await Promise.all([
      db.collection('matches').where('user1Id', '==', userId).get(),
      db.collection('matches').where('user2Id', '==', userId).get(),
    ]);
    for (const match of [...m1.docs, ...m2.docs]) {
      const msgs = await match.ref.collection('messages').get();
      await deleteInBatches(msgs.docs.map((d) => d.ref));
      await match.ref.delete();
    }
  } catch (e) {
    console.error('[moderation] onUserBanned cleanup failed', e);
  }
});

// ---- Algolia search indexing: keep `profiles` and `posts` indexes in sync ----
const toMillis = (ts: any): number =>
  ts && typeof ts.toMillis === 'function' ? ts.toMillis() : (ts?._seconds ?? ts?.seconds ?? 0) * 1000;

export const syncProfileIndex = onDocumentWritten(
  { document: 'profiles/{userId}', secrets: [ALGOLIA_ADMIN_KEY] },
  async (event) => {
    if (!ALGOLIA_APP_ID) return;
    const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY.value());
    const userId = event.params.userId;
    const p = event.data?.after.data();
    try {
      if (!p) {
        await client.deleteObject({ indexName: 'profiles', objectID: userId });
        return;
      }
      await client.saveObject({
        indexName: 'profiles',
        body: {
          objectID: userId,
          name: p.name ?? '',
          age: p.age ?? null,
          city: p.city ?? p.location ?? '',
          country: p.country ?? '',
          gender: p.gender ?? '',
          bio: p.bio ?? '',
          interests: Array.isArray(p.interests) ? p.interests : [],
          image: Array.isArray(p.images) ? (p.images[0] ?? '') : '',
          verified: p.verified === true,
        },
      });
    } catch (e) {
      console.error('[algolia] profile sync failed', e);
    }
  },
);

export const syncPostIndex = onDocumentWritten(
  { document: 'posts/{postId}', secrets: [ALGOLIA_ADMIN_KEY] },
  async (event) => {
    if (!ALGOLIA_APP_ID) return;
    const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY.value());
    const postId = event.params.postId;
    const p = event.data?.after.data();
    try {
      // Only index public (non-group) posts that have searchable text.
      if (!p || p.groupId || !p.text) {
        await client.deleteObject({ indexName: 'posts', objectID: postId });
        return;
      }
      await client.saveObject({
        indexName: 'posts',
        body: {
          objectID: postId,
          text: p.text,
          authorId: p.authorId ?? '',
          authorName: p.authorName ?? '',
          authorPhoto: p.authorPhoto ?? '',
          createdAt: toMillis(p.createdAt),
        },
      });
    } catch (e) {
      console.error('[algolia] post sync failed', e);
    }
  },
);
