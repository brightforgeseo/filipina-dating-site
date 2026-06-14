/**
 * 1-on-1 call lifecycle — the web mirror of the app's utils/videoCall.ts.
 *
 * Same `calls` collection, same field names and status values, and the Agora
 * channel is the call-doc id — exactly like mobile. So a web member and a
 * mobile member can call each other: whoever starts the call writes the doc,
 * the other side gets it via subscribeIncomingCalls, and both join the same
 * Agora channel (App-ID auth, no token — matching the app).
 */
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebase } from './firebase';

export type CallStatus = 'ringing' | 'active' | 'ended' | 'declined' | 'missed';

export type CallDoc = {
  id: string;
  callerId: string;
  calleeId: string;
  matchId: string;
  callerName: string;
  callerPhoto?: string | null;
  calleeName: string;
  calleePhoto?: string | null;
  status: CallStatus;
  createdAt?: any;
  acceptedAt?: any;
  endedAt?: any;
};

export const AGORA_APP_ID = (import.meta.env.PUBLIC_AGORA_APP_ID as string | undefined) || '';

export async function createCall(
  caller: { id: string; name: string; photo?: string },
  args: { calleeId: string; matchId: string; calleeName: string; calleePhoto?: string },
): Promise<string> {
  const { db } = firebase();
  const ref = await addDoc(collection(db, 'calls'), {
    callerId: caller.id,
    calleeId: args.calleeId,
    matchId: args.matchId,
    callerName: caller.name,
    callerPhoto: caller.photo ?? null,
    calleeName: args.calleeName,
    calleePhoto: args.calleePhoto ?? null,
    status: 'ringing' as CallStatus,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function acceptCall(callId: string): Promise<void> {
  const { db } = firebase();
  await updateDoc(doc(db, 'calls', callId), { status: 'active', acceptedAt: serverTimestamp() });
}

export async function declineCall(callId: string): Promise<void> {
  const { db } = firebase();
  await updateDoc(doc(db, 'calls', callId), { status: 'declined', endedAt: serverTimestamp() });
}

export async function endCall(callId: string): Promise<void> {
  const { db } = firebase();
  await updateDoc(doc(db, 'calls', callId), { status: 'ended', endedAt: serverTimestamp() });
}

export function subscribeIncomingCalls(userId: string, onCall: (call: CallDoc) => void): Unsubscribe {
  const { db } = firebase();
  const q = query(
    collection(db, 'calls'),
    where('calleeId', '==', userId),
    where('status', '==', 'ringing'),
  );
  return onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') {
        onCall({ id: change.doc.id, ...(change.doc.data() as Omit<CallDoc, 'id'>) });
      }
    });
  });
}

export function subscribeCall(callId: string, onChange: (call: CallDoc | null) => void): Unsubscribe {
  const { db } = firebase();
  return onSnapshot(doc(db, 'calls', callId), (snap) => {
    onChange(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<CallDoc, 'id'>) }) : null);
  });
}
