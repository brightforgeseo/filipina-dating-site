import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { firebase } from './firebase';
import type { Profile } from './profiles';
import { deterministicMatchId, deterministicMatchParticipants } from './matchIds';

export type SwipeDirection = 'left' | 'right' | 'up';

// Free members get 1 Super Like a day (Plus raises this in the mobile app).
export const FREE_SUPER_LIKES_PER_DAY = 1;

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

  const [fromUserProfile, toUserProfile] = await Promise.all([
    getDoc(doc(db, 'profiles', fromUserId)),
    getDoc(doc(db, 'profiles', toUserId)),
  ]);
  const profileById: Record<string, any> = {
    [fromUserId]: fromUserProfile.data() || {},
    [toUserId]: toUserProfile.data() || {},
  };
  const { user1Id, user2Id } = deterministicMatchParticipants(fromUserId, toUserId);
  const user1Data = profileById[user1Id] || {};
  const user2Data = profileById[user2Id] || {};
  const matchId = deterministicMatchId(fromUserId, toUserId);

  await setDoc(doc(db, 'matches', matchId), {
    user1Id,
    user2Id,
    user1Name: user1Data.name || 'User',
    user2Name: user2Data.name || 'User',
    user1Photo: user1Data.images?.[0] || DEFAULT_AVATAR,
    user2Photo: user2Data.images?.[0] || DEFAULT_AVATAR,
    createdAt: serverTimestamp(),
    lastMessage: null,
    lastMessageTime: null,
  });

  return { matched: true, matchedName: profileById[toUserId]?.name };
}

export async function getSwipedIds(userId: string): Promise<Set<string>> {
  const { db } = firebase();
  const snap = await getDocs(query(collection(db, 'swipes'), where('fromUserId', '==', userId)));
  const ids = new Set<string>();
  snap.forEach((d) => ids.add((d.data() as any).toUserId));
  return ids;
}

async function findExistingMatch(a: string, b: string): Promise<Match | null> {
  const { db } = firebase();
  const deterministic = await getDoc(doc(db, 'matches', deterministicMatchId(a, b)));
  if (deterministic.exists()) {
    return { id: deterministic.id, ...(deterministic.data() as any) } as Match;
  }

  const [s1, s2] = await Promise.all([
    getDocs(query(collection(db, 'matches'), where('user1Id', '==', a), where('user2Id', '==', b))),
    getDocs(query(collection(db, 'matches'), where('user1Id', '==', b), where('user2Id', '==', a))),
  ]);
  const first = s1.docs[0] || s2.docs[0];
  return first ? ({ id: first.id, ...(first.data() as any) } as Match) : null;
}

export type Liker = { profile: Profile; superLike: boolean };

// People who liked (or Super Liked) this user, newest distinct liker first.
export async function getLikers(userId: string): Promise<Liker[]> {
  const { db } = firebase();
  const snap = await getDocs(
    query(
      collection(db, 'swipes'),
      where('toUserId', '==', userId),
      where('direction', 'in', ['right', 'up'])
    )
  );
  const byUser = new Map<string, boolean>();
  snap.forEach((d) => {
    const s = d.data() as any;
    byUser.set(s.fromUserId, (byUser.get(s.fromUserId) ?? false) || s.direction === 'up');
  });
  const docs = await Promise.all([...byUser.keys()].map((id) => getDoc(doc(db, 'profiles', id))));
  const out: Liker[] = [];
  docs.forEach((p) => {
    if (p.exists()) out.push({ profile: { id: p.id, ...(p.data() as any) }, superLike: byUser.get(p.id) ?? false });
  });
  return out;
}

export async function getTodaySuperLikeCount(userId: string): Promise<number> {
  const { db } = firebase();
  const snap = await getDocs(
    query(collection(db, 'swipes'), where('fromUserId', '==', userId), where('direction', '==', 'up'))
  );
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  let n = 0;
  snap.forEach((d) => {
    const t = (d.data() as any).timestamp;
    if (t?.seconds && t.seconds * 1000 >= startOfDay.getTime()) n++;
  });
  return n;
}
