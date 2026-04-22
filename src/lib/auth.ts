import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { firebase } from './firebase';

export function watchAuth(cb: (user: User | null) => void) {
  const { auth } = firebase();
  return onAuthStateChanged(auth, cb);
}

export async function signUpEmail(email: string, password: string) {
  const { auth } = firebase();
  const res = await createUserWithEmailAndPassword(auth, email, password);
  return res.user;
}

export async function signInEmail(email: string, password: string) {
  const { auth } = firebase();
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

export async function signInGoogle() {
  const { auth } = firebase();
  const res = await signInWithPopup(auth, new GoogleAuthProvider());
  return res.user;
}

export async function signOutUser() {
  const { auth } = firebase();
  await signOut(auth);
}

export function currentUser(): User | null {
  const { auth } = firebase();
  return auth.currentUser;
}
