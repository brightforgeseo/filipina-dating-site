import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  limitToLast,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebase } from './firebase';
import { getProfile } from './profiles';

export type ChatMessage = {
  id: string;
  matchId: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  type: 'text' | 'image' | 'video';
  timestamp: any;
  isRead: boolean;
};

export type Conversation = {
  matchId: string;
  otherId: string;
  otherName: string;
  otherPhoto: string;
  lastMessage: string;
  lastMessageTime: any;
  unreadCount: number;
};

export async function sendMessage(matchId: string, senderId: string, text: string) {
  const { db } = firebase();
  await addDoc(collection(db, 'matches', matchId, 'messages'), {
    matchId,
    senderId,
    text,
    type: 'text',
    timestamp: serverTimestamp(),
    isRead: false,
  });
  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: text,
    lastMessageTime: serverTimestamp(),
  });
}

export async function markMessagesRead(matchId: string, otherId: string) {
  const { db } = firebase();
  const snap = await getDocs(
    query(
      collection(db, 'matches', matchId, 'messages'),
      where('senderId', '==', otherId),
      where('isRead', '==', false)
    )
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.forEach((d) => batch.update(d.ref, { isRead: true }));
  await batch.commit();
}

export function subscribeMessages(matchId: string, cb: (msgs: ChatMessage[]) => void): Unsubscribe {
  const { db } = firebase();
  // Newest 300 — long-running conversations otherwise grow unbounded in
  // both reads and render cost.
  const q = query(collection(db, 'matches', matchId, 'messages'), orderBy('timestamp', 'asc'), limitToLast(300));
  return onSnapshot(q, (snap) => {
    const out: ChatMessage[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
    cb(out);
  });
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { db } = firebase();
  const [s1, s2] = await Promise.all([
    getDocs(query(collection(db, 'matches'), where('user1Id', '==', userId))),
    getDocs(query(collection(db, 'matches'), where('user2Id', '==', userId))),
  ]);
  const conversations: Conversation[] = [];

  for (const m of [...s1.docs, ...s2.docs]) {
    const d: any = m.data();
    const otherIsUser2 = d.user1Id === userId;
    const otherId = otherIsUser2 ? d.user2Id : d.user1Id;
    const unread = await getDocs(
      query(
        collection(db, 'matches', m.id, 'messages'),
        where('senderId', '==', otherId),
        where('isRead', '==', false)
      )
    );
    const snapshotName = otherIsUser2 ? d.user2Name : d.user1Name;
    const snapshotPhoto = otherIsUser2 ? d.user2Photo : d.user1Photo;
    let liveProfile = null;
    try {
      liveProfile = await getProfile(otherId);
    } catch {
      // Keep the conversation usable if the profile read fails. Match snapshot
      // data is a fallback only; live profile data is the render source.
    }

    conversations.push({
      matchId: m.id,
      otherId,
      otherName: liveProfile?.name || snapshotName || 'Member',
      otherPhoto: liveProfile?.images?.find(Boolean) || snapshotPhoto || '',
      lastMessage: d.lastMessage || '',
      lastMessageTime: d.lastMessageTime,
      unreadCount: unread.size,
    });
  }

  conversations.sort((a, b) => (b.lastMessageTime?.seconds || 0) - (a.lastMessageTime?.seconds || 0));
  return conversations;
}

export function subscribeConversations(userId: string, cb: (cs: Conversation[]) => void): Unsubscribe {
  const { db } = firebase();
  let done1 = false, done2 = false;
  const emit = async () => {
    if (done1 && done2) cb(await getConversations(userId));
  };
  const u1 = onSnapshot(
    query(collection(db, 'matches'), where('user1Id', '==', userId)),
    async () => { done1 = true; await emit(); }
  );
  const u2 = onSnapshot(
    query(collection(db, 'matches'), where('user2Id', '==', userId)),
    async () => { done2 = true; await emit(); }
  );
  return () => { u1(); u2(); };
}

export type TimeStrings = {
  justNow: string;
  minutes: (m: number) => string;
  hours: (h: number) => string;
  yesterday: string;
  days: (d: number) => string;
};

const TIME_EN: TimeStrings = {
  justNow: 'Just now',
  minutes: (m) => `${m}m ago`,
  hours: (h) => `${h}h ago`,
  yesterday: 'Yesterday',
  days: (d) => `${d}d ago`,
};

export function formatTime(ts: any, t: TimeStrings = TIME_EN): string {
  if (!ts?.seconds) return '';
  const d = new Date(ts.seconds * 1000);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (m < 1) return t.justNow;
  if (m < 60) return t.minutes(m);
  if (h < 24) return t.hours(h);
  if (days === 1) return t.yesterday;
  if (days < 7) return t.days(days);
  return d.toLocaleDateString();
}

export async function sendImageMessage(matchId: string, senderId: string, imageUrl: string) {
  const { db } = firebase();
  await addDoc(collection(db, 'matches', matchId, 'messages'), {
    matchId,
    senderId,
    imageUrl,
    type: 'image',
    timestamp: serverTimestamp(),
    isRead: false,
  });
  await updateDoc(doc(db, 'matches', matchId), {
    lastMessage: '📷',
    lastMessageTime: serverTimestamp(),
  });
}
