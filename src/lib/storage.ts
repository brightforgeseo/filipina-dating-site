import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebase } from './firebase';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Phone photos are 3–8 MB; nothing in the app renders larger than ~1300px.
// Downscaling before upload makes uploads ~10x faster and every grid and
// feed dramatically lighter. Falls back to the original file on any failure
// (e.g. formats createImageBitmap can't decode).
export async function compressImage(
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<{ data: Blob; contentType: string; ext: string }> {
  const passthrough = { data: file as Blob, contentType: file.type, ext: extOf(file) };
  try {
    if (file.size < 300 * 1024) return passthrough;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return passthrough;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (blob && blob.size < file.size) return { data: blob, contentType: 'image/jpeg', ext: 'jpg' };
    return passthrough;
  } catch {
    return passthrough;
  }
}

function extOf(file: File): string {
  // The extension comes from a client-controlled filename — keep the object
  // path strictly alphanumeric.
  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? '';
  return /^[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : 'jpg';
}

async function uploadImageTo(path: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('too-large');
  const { storage } = firebase();
  const img = await compressImage(file);
  const r = ref(storage, `${path}/${Date.now()}.${img.ext}`);
  await uploadBytes(r, img.data, { contentType: img.contentType });
  return getDownloadURL(r);
}

export function uploadProfileImage(userId: string, file: File): Promise<string> {
  return uploadImageTo(`profile_images/${userId}`, file);
}

export function uploadChatImage(userId: string, file: File): Promise<string> {
  return uploadImageTo(`chat_images/${userId}`, file);
}
