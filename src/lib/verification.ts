import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebase } from './firebase';

export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type VerificationState = { status: VerificationStatus; verified: boolean };

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadVerificationFile(
  userId: string,
  kind: 'selfie' | 'idFront' | 'idBack',
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');
  if (file.size > MAX_BYTES) throw new Error('too-large');
  const { storage } = firebase();
  const r = ref(storage, `verification/${userId}/${kind}-${Date.now()}.jpg`);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}

export async function getVerification(userId: string): Promise<VerificationState | null> {
  const { db } = firebase();
  const snap = await getDoc(doc(db, 'verifications', userId));
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  return { status: (d.status as VerificationStatus) ?? 'pending', verified: d.verified === true };
}

export async function submitVerification(
  userId: string,
  data: { method: 'selfie' | 'id'; selfieUrl: string; idFrontUrl?: string; idBackUrl?: string },
): Promise<void> {
  const { db } = firebase();
  const r = doc(db, 'verifications', userId);
  const existing = await getDoc(r);
  const payload: Record<string, any> = {
    userId,
    method: data.method,
    selfieUrl: data.selfieUrl,
    status: 'pending',
    createdAt: serverTimestamp(),
  };
  if (data.idFrontUrl) payload.idFrontUrl = data.idFrontUrl;
  if (data.idBackUrl) payload.idBackUrl = data.idBackUrl;
  // `verified` must be absent-or-false on create, and the update rule forbids
  // touching `verified` at all — so only write it when first creating the doc.
  if (!existing.exists()) payload.verified = false;
  await setDoc(r, payload, { merge: true });
}
