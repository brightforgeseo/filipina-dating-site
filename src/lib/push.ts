/**
 * Web push registration.
 *
 * Mirrors the mobile app's push-token flow: once a user is signed in, request
 * notification permission, obtain an FCM web token, and store it on the shared
 * `pushTokens/{uid}` document (in the `webTokens` array) so the `app` Cloud
 * Functions can fan notifications out to the browser the same way they do to
 * the mobile app.
 *
 * Requires PUBLIC_FIREBASE_VAPID_KEY (Firebase console → Project settings →
 * Cloud Messaging → Web Push certificates). Without it, web push no-ops cleanly.
 */
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { firebase } from './firebase';

const VAPID_KEY = import.meta.env.PUBLIC_FIREBASE_VAPID_KEY as string | undefined;

let started = false;

export async function registerWebPush(user: User): Promise<void> {
  if (started) return;
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  if (!VAPID_KEY) {
    console.warn('[push] PUBLIC_FIREBASE_VAPID_KEY is not set — web push disabled.');
    return;
  }

  try {
    if (!(await isSupported())) return;

    // Ask only if we have not been answered yet; granted/denied return instantly.
    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== 'granted') return;

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const { app, db } = firebase();
    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return;

    await setDoc(
      doc(db, 'pushTokens', user.uid),
      {
        userId: user.uid,
        webTokens: arrayUnion(token),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    started = true;

    // While a tab is focused the background SW does not fire, so surface
    // foreground messages ourselves.
    onMessage(messaging, (payload) => {
      const n = payload.notification;
      const title = n?.title || payload.data?.title || 'FilWest';
      const body = n?.body || payload.data?.body || '';
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-512.png' });
      }
    });
  } catch (e) {
    console.warn('[push] web push registration failed', e);
  }
}
