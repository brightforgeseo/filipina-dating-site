import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { deleteObject, listAll, ref as storageRef } from 'firebase/storage';
import { firebase } from './firebase';
import { unmatch } from './blocking';

// Firebase requires a recent login to delete an account; checking up front
// means we never start destroying data only to fail at the auth step.
export function needsReauthForDeletion(): boolean {
  const { auth } = firebase();
  const last = auth.currentUser?.metadata?.lastSignInTime;
  if (!last) return false;
  return Date.now() - new Date(last).getTime() > 4 * 60 * 1000;
}

// Best-effort purge of everything an account owns beyond the profile doc:
// conversations/matches, swipes, push tokens, presence, and uploaded photos.
// Each step is independent — a failure in one never blocks the others.
export async function purgeAccountData(userId: string): Promise<void> {
  const { db, storage } = firebase();

  const matches = await Promise.all([
    getDocs(query(collection(db, 'matches'), where('user1Id', '==', userId))).catch(() => null),
    getDocs(query(collection(db, 'matches'), where('user2Id', '==', userId))).catch(() => null),
  ]);
  for (const snap of matches) {
    if (!snap) continue;
    for (const m of snap.docs) {
      await unmatch(m.id).catch(() => {});
    }
  }

  const swipes = await getDocs(
    query(collection(db, 'swipes'), where('fromUserId', '==', userId))
  ).catch(() => null);
  if (swipes) {
    await Promise.all(swipes.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  }

  await deleteDoc(doc(db, 'pushTokens', userId)).catch(() => {});
  await deleteDoc(doc(db, 'presence', userId)).catch(() => {});

  // Photos: both the web and mobile upload paths.
  for (const folder of [`profile_images/${userId}`, `profile-images/${userId}`, `chat_images/${userId}`, `post_media/${userId}`]) {
    try {
      const listing = await listAll(storageRef(storage, folder));
      await Promise.all(listing.items.map((i) => deleteObject(i).catch(() => {})));
    } catch {}
  }
}
