import { httpsCallable } from 'firebase/functions';
import { firebase } from './firebase';

// Keep in sync with the app (utils/boost.ts) and functions/src/index.ts.
export const BOOST_PACKAGES = [
  { id: '30m', label: '30 minutes', coins: 50 },
  { id: '1h', label: '1 hour', coins: 90, popular: true },
  { id: '3h', label: '3 hours', coins: 200 },
  { id: '24h', label: '24 hours', coins: 600, bestValue: true },
] as const;

/** Spend coins to boost the signed-in member. Returns the new boostedUntil (ms). */
export async function activateBoost(packageId: string): Promise<number> {
  const { functions } = firebase();
  const fn = httpsCallable<{ packageId: string }, { boostedUntil: number }>(functions, 'activateBoost');
  const res = await fn({ packageId });
  return res.data?.boostedUntil ?? 0;
}

/** ms left on a boost, from a profile's boostedUntil Firestore timestamp. */
export function boostMsLeft(boostedUntil: any): number {
  const ms = boostedUntil?.seconds ? boostedUntil.seconds * 1000 : 0;
  return Math.max(0, ms - Date.now());
}
