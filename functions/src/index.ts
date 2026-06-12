import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

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
