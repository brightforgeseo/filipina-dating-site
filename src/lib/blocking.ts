import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firebase } from './firebase';

export async function blockUser(blockerId: string, blockedId: string) {
  const { db } = firebase();
  await addDoc(collection(db, 'blocks'), {
    blockerId,
    blockedId,
    createdAt: serverTimestamp(),
  });
}

// Both directions: people I blocked, and people who blocked me — neither
// side should see the other anywhere in the app.
export async function getBlockedIds(userId: string): Promise<Set<string>> {
  const { db } = firebase();
  const [mine, theirs] = await Promise.all([
    getDocs(query(collection(db, 'blocks'), where('blockerId', '==', userId))),
    getDocs(query(collection(db, 'blocks'), where('blockedId', '==', userId))),
  ]);
  const ids = new Set<string>();
  mine.forEach((d) => ids.add((d.data() as any).blockedId));
  theirs.forEach((d) => ids.add((d.data() as any).blockerId));
  return ids;
}

export async function unmatch(matchId: string) {
  const { db } = firebase();
  const msgs = await getDocs(collection(db, 'matches', matchId, 'messages'));
  // Firestore batches cap at 500 writes — chunk the message deletions.
  const refs = msgs.docs.map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'matches', matchId));
}
