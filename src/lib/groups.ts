import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { firebase } from './firebase';

export type Group = {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  ownerName: string;
  createdAt: any;
};

const memberDocId = (groupId: string, userId: string) => `${groupId}_${userId}`;

export async function createGroup(owner: { id: string; name: string }, name: string, description: string): Promise<Group> {
  const { db } = firebase();
  const payload = {
    name: name.trim(),
    description: description.trim(),
    ownerId: owner.id,
    ownerName: owner.name,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'groups'), payload);
  await joinGroup(ref.id, owner);
  return { id: ref.id, ...payload, createdAt: { seconds: Math.floor(Date.now() / 1000) } };
}

export async function listGroups(max = 50): Promise<Group[]> {
  const { db } = firebase();
  const snap = await getDocs(query(collection(db, 'groups'), orderBy('createdAt', 'desc'), limit(max)));
  const out: Group[] = [];
  snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
  return out;
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const { db } = firebase();
  const snap = await getDoc(doc(db, 'groups', groupId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Group) : null;
}

export async function joinGroup(groupId: string, user: { id: string; name: string }) {
  const { db } = firebase();
  await setDoc(doc(db, 'groupMembers', memberDocId(groupId, user.id)), {
    groupId,
    userId: user.id,
    name: user.name,
    createdAt: serverTimestamp(),
  });
}

export async function leaveGroup(groupId: string, userId: string) {
  const { db } = firebase();
  await deleteDoc(doc(db, 'groupMembers', memberDocId(groupId, userId)));
}

export async function getMyGroupIds(userId: string): Promise<Set<string>> {
  const { db } = firebase();
  const snap = await getDocs(query(collection(db, 'groupMembers'), where('userId', '==', userId)));
  const ids = new Set<string>();
  snap.forEach((d) => ids.add((d.data() as any).groupId));
  return ids;
}

export async function getMemberCount(groupId: string): Promise<number> {
  const { db } = firebase();
  const snap = await getCountFromServer(query(collection(db, 'groupMembers'), where('groupId', '==', groupId)));
  return snap.data().count;
}
