import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { firebase } from './firebase';

let registered = false;

// Best-effort presence: mark online when an app page mounts, offline on
// pagehide. Without a backend presence system (Realtime DB onDisconnect)
// a killed tab can leave `online: true` behind — `lastActive` is the
// reliable signal; `online` is cosmetic.
// The mobile app reads presence/{uid} instead of the profile doc, so mirror
// there too — otherwise mobile members never see web members as online.
export function markOnline(userId: string) {
  const { db } = firebase();
  const ref = doc(db, 'profiles', userId);
  const presenceRef = doc(db, 'presence', userId);
  updateDoc(ref, { online: true, lastActive: serverTimestamp() }).catch(() => {});
  setDoc(presenceRef, { online: true, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
  if (!registered) {
    registered = true;
    window.addEventListener('pagehide', () => {
      updateDoc(ref, { online: false, lastActive: serverTimestamp() }).catch(() => {});
      setDoc(presenceRef, { online: false, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    });
  }
}
