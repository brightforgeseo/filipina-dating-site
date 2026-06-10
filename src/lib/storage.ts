import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebase } from './firebase';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadProfileImage(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('too-large');
  const { storage } = firebase();
  // The extension comes from a client-controlled filename — keep the object
  // path strictly alphanumeric.
  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? '';
  const ext = /^[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : 'jpg';
  const r = ref(storage, `profile_images/${userId}/${Date.now()}.${ext}`);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
