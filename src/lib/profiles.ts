import {
  collection,
  deleteDoc,
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
  occupation?: string;
  education?: string;
  height?: number; // cm
  religion?: string;
  drinking?: string;
  smoking?: string;
  verified?: boolean;
  online?: boolean;
  preferences?: { gender?: 'female' | 'male' | 'all'; ageMin?: number; ageMax?: number; country?: string };
  lastActive?: any;
  createdAt?: any;
};

function profileFromDoc(id: string, data: Record<string, any>): Profile {
  // The Firestore document ID is the user's real profile ID. Never allow a
  // persisted `id` field inside the document body to override it, or two
  // different profiles can render/link/swipe as the same person.
  const { id: _ignoredId, ...profileData } = data;
  return { ...(profileData as any), id };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { db } = firebase();
  const snap = await getDoc(doc(db, 'profiles', userId));
  if (!snap.exists()) return null;
  return profileFromDoc(snap.id, snap.data() as Record<string, any>);
}

export async function saveProfile(userId: string, data: Partial<Profile>) {
  const { db } = firebase();
  const ref = doc(db, 'profiles', userId);
  // Firestore rejects undefined field values, and createdAt must only be
  // written once or edits would reset the original signup date. `id` is route
  // state, not profile data; storing it can corrupt later client-side identity.
  const payload: Record<string, any> = Object.fromEntries(
    Object.entries(data).filter(([k, v]) => k !== 'id' && v !== undefined)
  );
  payload.lastActive = serverTimestamp();

  if (!payload.createdAt) {
    const existing = await getDoc(ref);
    if (!existing.exists()) payload.createdAt = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
}

export async function deleteProfile(userId: string) {
  const { db } = firebase();
  await deleteDoc(doc(db, 'profiles', userId));
}

export async function listProfiles(opts: { excludeId?: string; max?: number } = {}): Promise<Profile[]> {
  const { db } = firebase();
  const max = opts.max ?? 25;
  const snap = await getDocs(query(collection(db, 'profiles'), limit(max + (opts.excludeId ? 1 : 0))));
  const out: Profile[] = [];
  snap.forEach((d) => {
    if (opts.excludeId && d.id === opts.excludeId) return;
    out.push(profileFromDoc(d.id, d.data() as Record<string, any>));
  });
  return out.slice(0, max);
}
