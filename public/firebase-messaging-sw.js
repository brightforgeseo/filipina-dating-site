/* FilWest web push service worker.
 *
 * Receives FCM web push messages and displays them when the site is in the
 * background. The Firebase config below is the public web config (the same
 * client keys already shipped in the app bundle) — safe to expose; real
 * security is enforced by Firestore rules. A service worker cannot read
 * import.meta.env, so the config is inlined here.
 *
 * Messages are sent from the `app` Cloud Functions codebase as `webpush`
 * payloads, so the messaging SDK's default handler renders them automatically.
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC9xZNXi3i1bHEObdOEd4S5E1GPfMj6Slg',
  authDomain: 'filwest.firebaseapp.com',
  projectId: 'filwest',
  storageBucket: 'filwest.firebasestorage.app',
  messagingSenderId: '675978841548',
  appId: '1:675978841548:web:8b80d3351d93c0f1606169',
});

// Initializing messaging registers the default background handler, which shows
// the `webpush.notification` payload. Click-through is handled by the
// notification's fcmOptions.link (set when WEB_BASE_URL is configured).
firebase.messaging();
