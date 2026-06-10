import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
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

export async function resetPassword(email: string) {
  const { auth } = firebase();
  await sendPasswordResetEmail(auth, email);
}

export async function sendVerification(user: User) {
  await sendEmailVerification(user);
}

// Google accounts arrive verified; only password accounts need the email step.
export function needsEmailVerification(user: User): boolean {
  return user.providerData.some((p) => p.providerId === 'password') && !user.emailVerified;
}

export async function deleteAccount() {
  const { auth } = firebase();
  const u = auth.currentUser;
  if (!u) throw new Error('not-signed-in');
  await deleteUser(u);
}

export function currentUser(): User | null {
  const { auth } = firebase();
  return auth.currentUser;
}
