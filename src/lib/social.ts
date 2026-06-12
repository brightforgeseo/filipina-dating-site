import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as qLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { firebase } from './firebase';

// ---------- Follows ----------

const followDocId = (followerId: string, followedId: string) => `${followerId}_${followedId}`;

export async function follow(followerId: string, followedId: string) {
  const { db } = firebase();
  await setDoc(doc(db, 'follows', followDocId(followerId, followedId)), {
    followerId,
    followedId,
    createdAt: serverTimestamp(),
  });
}

export async function unfollow(followerId: string, followedId: string) {
  const { db } = firebase();
  await deleteDoc(doc(db, 'follows', followDocId(followerId, followedId)));
}

export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
  const { db } = firebase();
  const snap = await getDoc(doc(db, 'follows', followDocId(followerId, followedId)));
  return snap.exists();
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const { db } = firebase();
  const [followers, following] = await Promise.all([
    getCountFromServer(query(collection(db, 'follows'), where('followedId', '==', userId))),
    getCountFromServer(query(collection(db, 'follows'), where('followerId', '==', userId))),
  ]);
  return { followers: followers.data().count, following: following.data().count };
}

export async function getFollowingIds(userId: string): Promise<Set<string>> {
  const { db } = firebase();
  const snap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', userId)));
  const ids = new Set<string>();
  snap.forEach((d) => ids.add((d.data() as any).followedId));
  return ids;
}

// ---------- Free gifts on posts (engagement only — no money involved) ----------

export const GIFT_TYPES = ['rose', 'heart', 'kiss', 'crown'] as const;
export type GiftType = (typeof GIFT_TYPES)[number];
export const GIFT_EMOJI: Record<GiftType, string> = {
  rose: '🌹',
  heart: '💖',
  kiss: '😘',
  crown: '👑',
};

export async function sendGift(postId: string, sender: { id: string; name: string }, type: GiftType) {
  const { db } = firebase();
  await addDoc(collection(db, 'posts', postId, 'gifts'), {
    senderId: sender.id,
    senderName: sender.name,
    type,
    createdAt: serverTimestamp(),
  });
}

export async function getGiftCount(postId: string): Promise<number> {
  const { db } = firebase();
  const snap = await getCountFromServer(collection(db, 'posts', postId, 'gifts'));
  return snap.data().count;
}

// ---------- Gifts sent directly to a member's profile ----------

export async function sendProfileGiftFree(targetId: string, sender: { id: string; name: string }, type: GiftType | string) {
  const { db } = firebase();
  await addDoc(collection(db, 'profiles', targetId, 'gifts'), {
    senderId: sender.id,
    senderName: sender.name,
    type,
    createdAt: serverTimestamp(),
  });
}

export async function getProfileGiftInfo(userId: string): Promise<{ count: number; recent: string[] }> {
  const { db } = firebase();
  const giftsRef = collection(db, 'profiles', userId, 'gifts');
  const [countSnap, recentSnap] = await Promise.all([
    getCountFromServer(giftsRef),
    getDocs(query(giftsRef, orderBy('createdAt', 'desc'), qLimit(8))),
  ]);
  const recent: string[] = [];
  recentSnap.forEach((d) => recent.push((d.data() as any).type));
  return { count: countSnap.data().count, recent };
}
