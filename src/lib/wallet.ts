import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebase } from './firebase';

// Keep in sync with functions/src/index.ts.
export const COIN_PACKAGES = [
  { id: 'starter', coins: 100, usd: 4.99 },
  { id: 'plus', coins: 550, usd: 19.99 },
  { id: 'max', coins: 1200, usd: 39.99 },
] as const;

export const PAID_GIFTS = [
  { type: 'rose', emoji: '🌹', coins: 5 },
  { type: 'heart', emoji: '💖', coins: 10 },
  { type: 'kiss', emoji: '😘', coins: 25 },
  { type: 'crown', emoji: '👑', coins: 50 },
  { type: 'diamond', emoji: '💎', coins: 100 },
  { type: 'castle', emoji: '🏰', coins: 500 },
] as const;

export const PAYOUT_USD_PER_COIN = 0.025;
export const MIN_PAYOUT_COINS = 1000;

export type Wallet = { coins: number; earned: number };

// Paid gifting stays off until config/app.paidGiftsEnabled is set true in
// the console (after Cloud Functions + Stripe are deployed).
export async function isPaidGiftsEnabled(): Promise<boolean> {
  try {
    const { db } = firebase();
    const snap = await getDoc(doc(db, 'config', 'app'));
    return snap.exists() && snap.data().paidGiftsEnabled === true;
  } catch {
    return false;
  }
}

export function subscribeWallet(userId: string, cb: (w: Wallet) => void): Unsubscribe {
  const { db } = firebase();
  return onSnapshot(doc(db, 'wallets', userId), (snap) => {
    const d = snap.data() ?? {};
    cb({ coins: (d.coins as number) ?? 0, earned: (d.earned as number) ?? 0 });
  });
}

export async function startCoinCheckout(packageId: string): Promise<void> {
  const { functions } = firebase();
  const fn = httpsCallable<{ packageId: string }, { url: string }>(functions, 'createCoinCheckout');
  const res = await fn({ packageId });
  if (!res.data?.url) throw new Error('no-checkout-url');
  window.location.href = res.data.url;
}

export async function sendPaidGiftFn(postId: string, giftType: string): Promise<void> {
  const { functions } = firebase();
  const fn = httpsCallable(functions, 'sendPaidGift');
  await fn({ postId, giftType });
}

export async function requestPayoutFn(gcash: string): Promise<void> {
  const { functions } = firebase();
  const fn = httpsCallable(functions, 'requestPayout');
  await fn({ gcash });
}
