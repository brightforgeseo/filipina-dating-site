import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const fallbackConfig = {
  apiKey: 'AIzaSyC9xZNXi3i1bHEObdOEd4S5E1GPfMj6Slg',
  authDomain: 'filwest.firebaseapp.com',
  projectId: 'filwest',
  storageBucket: 'filwest.firebasestorage.app',
  messagingSenderId: '675978841548',
  appId: '1:675978841548:web:8b80d3351d93c0f1606169',
};

const config = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || fallbackConfig.appId,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

export function firebase() {
  if (!_app) {
    if (!config.apiKey || !config.projectId || !config.appId) {
      // Log loudly — the auth forms catch this error and show a soft message,
      // which makes a missing-config deploy look like a silent failure.
      console.error(
        '[FilWest] Firebase is NOT configured on this deploy. ' +
          'Set the PUBLIC_FIREBASE_* environment variables in Netlify ' +
          '(Site configuration → Environment variables) and trigger a redeploy. See .env.example.'
      );
      throw new Error('firebase-not-configured');
    }
    _app = getApps().length ? getApps()[0] : initializeApp(config);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    _storage = getStorage(_app);
  }
  return { app: _app!, auth: _auth!, db: _db!, storage: _storage! };
}
