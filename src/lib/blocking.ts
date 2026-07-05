import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firebase } from './firebase';

export async function blockUser(blockerId: string, blockedId: string) {
  const { db } = firebase();
  // Deterministic doc id and both field spellings (blockedId here,
  // blockedUserId on mobile) so a block made on either platform is found by
  // the other's lookups.
  await setDoc(doc(db, 'blocks', `${blockerId}_${blockedId}`), {
    blockerId,
    blockedId,
    blockedUserId: blockedId,
    createdAt: serverTimestamp(),
    timestamp: serverTimestamp(),
  });
}

// Ids to hide from this user's feeds everywhere: people I blocked, people who
// blocked me, AND anyone an admin has banned. Folding bans in here means every
// surface that already filters blocked users (Browse, Community, For-You, Live,
// Chat) enforces bans too, with no per-feed changes.
export async function getBlockedIds(userId: string): Promise<Set<string>> {
  const { db } = firebase();
  const [mine, theirs, theirsMobile, banned] = await Promise.all([
    getDocs(query(collection(db, 'blocks'), where('blockerId', '==', userId))),
    getDocs(query(collection(db, 'blocks'), where('blockedId', '==', userId))),
    // Mobile-created blocks use blockedUserId — query both spellings.
    getDocs(query(collection(db, 'blocks'), where('blockedUserId', '==', userId))),
    getDocs(query(collection(db, 'bans'), limit(1000))).catch(() => null),
  ]);
  const ids = new Set<string>();
  mine.forEach((d) => {
    const data = d.data() as any;
    const target = data.blockedId || data.blockedUserId;
    if (target) ids.add(target);
  });
  theirs.forEach((d) => ids.add((d.data() as any).blockerId));
  theirsMobile.forEach((d) => ids.add((d.data() as any).blockerId));
  banned?.forEach((d) => ids.add(d.id));
  return ids;
}

// Unmatch: delete the conversation, my swipes toward the other member (so a
// stale reciprocal like can't silently recreate the match), and the match doc.
export async function unmatch(matchId: string) {
  const { db, auth } = firebase();
  const uid = auth.currentUser?.uid;

  // Read participants before deleting anything.
  const matchSnap = await getDoc(doc(db, 'matches', matchId));
  const match = matchSnap.exists() ? (matchSnap.data() as any) : null;
  const otherId = match && uid ? (match.user1Id === uid ? match.user2Id : match.user1Id) : null;

  const [msgs, typing, mySwipes] = await Promise.all([
    getDocs(collection(db, 'matches', matchId, 'messages')),
    getDocs(collection(db, 'matches', matchId, 'typing')),
    otherId
      ? getDocs(query(
          collection(db, 'swipes'),
          where('fromUserId', '==', uid),
          where('toUserId', '==', otherId)
        ))
      : Promise.resolve(null),
  ]);

  // Firestore batches cap at 500 writes — chunk the deletions. Rules only
  // allow deleting your own typing doc.
  const refs = [
    ...msgs.docs.map((d) => d.ref),
    ...typing.docs.filter((d) => d.id === uid).map((d) => d.ref),
    ...(mySwipes ? mySwipes.docs.map((d) => d.ref) : []),
  ];
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'matches', matchId));
}
