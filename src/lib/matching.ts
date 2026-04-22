import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { firebase } from './firebase';

export type SwipeDirection = 'left' | 'right' | 'up';

export type Match = {
  id: string;
  user1Id: string;
  user2Id: string;
  user1Name: string;
  user2Name: string;
  user1Photo: string;
  user2Photo: string;
  createdAt: any;
  lastMessage?: string;
  lastMessageTime?: any;
};

const DEFAULT_AVATAR = '';

export async function recordSwipe(
  fromUserId: string,
  toUserId: string,
  direction: SwipeDirection
): Promise<{ matched: boolean; matchedName?: string }> {
  const { db } = firebase();
  await addDoc(collection(db, 'swipes'), {
    fromUserId,
    toUserId,
    direction,
    timestamp: serverTimestamp(),
  });

  if (direction !== 'right' && direction !== 'up') return { matched: false };

  const reciprocal = await getDocs(
    query(
      collection(db, 'swipes'),
      where('fromUserId', '==', toUserId),
      where('toUserId', '==', fromUserId),
      where('direction', 'in', ['right', 'up'])
    )
  );
  if (reciprocal.empty) return { matched: false };

  const existing = await findExistingMatch(fromUserId, toUserId);
  if (existing) {
    return { matched: true, matchedName: existing.user1Id === fromUserId ? existing.user2Name : existing.user1Name };
  }

  const [u1, u2] = await Promise.all([
    getDoc(doc(db, 'profiles', fromUserId)),
    getDoc(doc(db, 'profiles', toUserId)),
  ]);
  const u1d = u1.data() || {};
  const u2d = u2.data() || {};

  const matchRef = await addDoc(collection(db, 'matches'), {
    user1Id: fromUserId,
    user2Id: toUserId,
    user1Name: u1d.name || 'User',
    user2Name: u2d.name || 'User',
    user1Photo: u1d.images?.[0] || DEFAULT_AVATAR,
    user2Photo: u2d.images?.[0] || DEFAULT_AVATAR,
    createdAt: serverTimestamp(),
    lastMessage: null,
    lastMessageTime: null,
  });

  return { matched: true, matchedName: u2d.name };
}

async function findExistingMatch(a: string, b: string): Promise<Match | null> {
  const { db } = firebase();
  const [s1, s2] = await Promise.all([
    getDocs(query(collection(db, 'matches'), where('user1Id', '==', a), where('user2Id', '==', b))),
    getDocs(query(collection(db, 'matches'), where('user1Id', '==', b), where('user2Id', '==', a))),
  ]);
  const first = s1.docs[0] || s2.docs[0];
  return first ? ({ id: first.id, ...(first.data() as any) } as Match) : null;
}
