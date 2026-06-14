import { httpsCallable } from 'firebase/functions';
import { firebase } from './firebase';

// Translate via the shared Cloud Function (Google Cloud Translation). Returns
// the original text on failure so the UI degrades gracefully.
export async function translateText(text: string, target: string): Promise<string> {
  if (!text?.trim()) return text;
  try {
    const { functions } = firebase();
    const fn = httpsCallable<{ text: string; target: string }, { text: string }>(functions, 'translateText');
    const res = await fn({ text, target });
    return res.data?.text || text;
  } catch {
    return text;
  }
}
