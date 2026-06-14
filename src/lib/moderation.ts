import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebase } from './firebase';

export type Report = {
  id: string;
  reporterId: string;
  targetId: string;
  reason: string;
  status: string;
  details?: string;
  matchId?: string;
  messageId?: string;
  messageText?: string;
  snippet?: string;
  kind?: string;
  postId?: string;
  autoFlag?: boolean;
  createdAt: any;
};

export type Ban = { id: string; reason?: string; createdAt: any };

export async function isAdmin(uid: string): Promise<boolean> {
  const { db } = firebase();
  const snap = await getDoc(doc(db, 'admins', uid)).catch(() => null);
  return !!snap?.exists();
}

export function subscribeOpenReports(cb: (reports: Report[]) => void): Unsubscribe {
  const { db } = firebase();
  const q = query(collection(db, 'reports'), where('status', '==', 'open'), limit(100));
  return onSnapshot(q, (snap) => {
    const out: Report[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
    out.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(out);
  });
}

export async function resolveReport(id: string, action: string): Promise<void> {
  const { db } = firebase();
  await updateDoc(doc(db, 'reports', id), { status: 'resolved', action, resolvedAt: serverTimestamp() });
}

export async function banUser(uid: string, reason = ''): Promise<void> {
  const { db } = firebase();
  await setDoc(doc(db, 'bans', uid), { userId: uid, reason, createdAt: serverTimestamp() });
}

export async function unbanUser(uid: string): Promise<void> {
  const { db } = firebase();
  await deleteDoc(doc(db, 'bans', uid));
}

// Banned ids, read by feeds to exclude banned members.
export async function getBannedIds(): Promise<Set<string>> {
  const { db } = firebase();
  const snap = await getDocs(query(collection(db, 'bans'), limit(1000)));
  const ids = new Set<string>();
  snap.forEach((d) => ids.add(d.id));
  return ids;
}

export function subscribeBans(cb: (bans: Ban[]) => void): Unsubscribe {
  const { db } = firebase();
  return onSnapshot(query(collection(db, 'bans'), limit(200)), (snap) => {
    const out: Ban[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
    cb(out);
  });
}

// Content removal — admin rules permit these deletes.
export async function deletePost(postId: string): Promise<void> {
  const { db } = firebase();
  await deleteDoc(doc(db, 'posts', postId));
}

export async function deleteMessage(matchId: string, messageId: string): Promise<void> {
  const { db } = firebase();
  await deleteDoc(doc(db, 'matches', matchId, 'messages', messageId));
}
