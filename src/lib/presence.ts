import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firebase } from './firebase';

let registered = false;

// Best-effort presence: mark online when an app page mounts, offline on
// pagehide. Without a backend presence system (Realtime DB onDisconnect)
// a killed tab can leave `online: true` behind — `lastActive` is the
// reliable signal; `online` is cosmetic.
export function markOnline(userId: string) {
  const { db } = firebase();
  const ref = doc(db, 'profiles', userId);
  updateDoc(ref, { online: true, lastActive: serverTimestamp() }).catch(() => {});
  if (!registered) {
    registered = true;
    window.addEventListener('pagehide', () => {
      updateDoc(ref, { online: false, lastActive: serverTimestamp() }).catch(() => {});
    });
  }
}
