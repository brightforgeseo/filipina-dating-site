import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { firebase } from './firebase';

export type Profile = {
  id: string;
  name: string;
  age?: number;
  gender?: 'female' | 'male' | 'other';
  city?: string;
  country?: string;
  bio?: string;
  images?: string[];
  interests?: string[];
  lookingFor?: string;
  verified?: boolean;
  online?: boolean;
  lastActive?: any;
  createdAt?: any;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { db } = firebase();
  const snap = await getDoc(doc(db, 'profiles', userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) };
}

export async function saveProfile(userId: string, data: Partial<Profile>) {
  const { db } = firebase();
  await setDoc(
    doc(db, 'profiles', userId),
    {
      ...data,
      createdAt: data.createdAt ?? serverTimestamp(),
      lastActive: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function listProfiles(opts: { excludeId?: string; max?: number } = {}): Promise<Profile[]> {
  const { db } = firebase();
  const max = opts.max ?? 25;
  const snap = await getDocs(query(collection(db, 'profiles'), limit(max + (opts.excludeId ? 1 : 0))));
  const out: Profile[] = [];
  snap.forEach((d) => {
    if (opts.excludeId && d.id === opts.excludeId) return;
    out.push({ id: d.id, ...(d.data() as any) });
  });
  return out.slice(0, max);
}
