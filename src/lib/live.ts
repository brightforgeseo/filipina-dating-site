import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebase } from './firebase';

export type Stream = {
  id: string;
  hostId: string;
  hostName: string;
  hostPhoto?: string;
  title: string;
  status: 'live' | 'ended';
  createdAt: any;
};

export type StreamMessage = {
  id: string;
  type?: 'text' | 'gift';
  senderId: string;
  senderName: string;
  text?: string;
  giftType?: string;
  createdAt: any;
};

// Browser-to-browser broadcast caps out on the host's upload bandwidth.
// Swap the transport for LiveKit/Agora when streams outgrow this.
export const MAX_VIEWERS = 10;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

// ---------- Stream lifecycle ----------

export async function startStream(host: { id: string; name: string; photo?: string }, title: string): Promise<string> {
  const { db } = firebase();
  const payload: Record<string, any> = {
    hostId: host.id,
    hostName: host.name,
    title: title.trim(),
    status: 'live',
    createdAt: serverTimestamp(),
  };
  if (host.photo) payload.hostPhoto = host.photo;
  const ref = await addDoc(collection(db, 'streams'), payload);
  return ref.id;
}

export async function endStream(streamId: string) {
  const { db } = firebase();
  await updateDoc(doc(db, 'streams', streamId), { status: 'ended', endedAt: serverTimestamp() });
}

export function subscribeStream(streamId: string, cb: (s: Stream | null) => void): Unsubscribe {
  const { db } = firebase();
  return onSnapshot(doc(db, 'streams', streamId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Stream) : null);
  });
}

// Single equality filter — no composite index needed; sorted client-side.
export function subscribeLiveStreams(cb: (streams: Stream[]) => void): Unsubscribe {
  const { db } = firebase();
  return onSnapshot(query(collection(db, 'streams'), where('status', '==', 'live'), limit(20)), (snap) => {
    const out: Stream[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
    out.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(out);
  });
}

// ---------- Presence & chat ----------

export async function joinAsViewer(streamId: string, viewer: { id: string; name: string }) {
  const { db } = firebase();
  await setDoc(doc(db, 'streams', streamId, 'viewers', viewer.id), {
    name: viewer.name,
    joinedAt: serverTimestamp(),
  });
}

export async function leaveAsViewer(streamId: string, viewerId: string) {
  const { db } = firebase();
  await deleteDoc(doc(db, 'streams', streamId, 'viewers', viewerId)).catch(() => {});
}

export function subscribeViewerCount(streamId: string, cb: (n: number) => void): Unsubscribe {
  const { db } = firebase();
  return onSnapshot(collection(db, 'streams', streamId, 'viewers'), (snap) => cb(snap.size));
}

export function subscribeStreamMessages(streamId: string, cb: (msgs: StreamMessage[]) => void): Unsubscribe {
  const { db } = firebase();
  const q = query(collection(db, 'streams', streamId, 'messages'), orderBy('createdAt', 'asc'), limit(200));
  return onSnapshot(q, (snap) => {
    const out: StreamMessage[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
    cb(out);
  });
}

export async function sendStreamMessage(streamId: string, sender: { id: string; name: string }, text: string) {
  const { db } = firebase();
  await addDoc(collection(db, 'streams', streamId, 'messages'), {
    type: 'text',
    senderId: sender.id,
    senderName: sender.name,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}

// Free-mode stream gift (paid mode goes through the sendStreamGift function).
export async function sendStreamGiftFree(streamId: string, sender: { id: string; name: string }, giftType: string) {
  const { db } = firebase();
  await addDoc(collection(db, 'streams', streamId, 'gifts'), {
    senderId: sender.id,
    senderName: sender.name,
    type: giftType,
    createdAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'streams', streamId, 'messages'), {
    type: 'gift',
    senderId: sender.id,
    senderName: sender.name,
    giftType,
    createdAt: serverTimestamp(),
  });
}

export async function sendStreamGiftPaid(streamId: string, giftType: string) {
  const { functions } = firebase();
  await httpsCallable(functions, 'sendStreamGift')({ streamId, giftType });
}

// ---------- WebRTC: host side ----------
// Each viewer writes an SDP offer into connections/{viewerId}; the host
// answers with its camera tracks attached and both sides trade ICE
// candidates through subcollections.

export function broadcast(streamId: string, media: MediaStream): () => void {
  const { db } = firebase();
  const pcs = new Map<string, RTCPeerConnection>();
  const subs: Unsubscribe[] = [];

  const connectionsRef = collection(db, 'streams', streamId, 'connections');
  const unsubConnections = onSnapshot(connectionsRef, (snap) => {
    snap.docChanges().forEach(async (change) => {
      const data = change.doc.data();
      const viewerId = change.doc.id;
      if (change.type === 'removed') {
        pcs.get(viewerId)?.close();
        pcs.delete(viewerId);
        return;
      }
      if (!data.offer || data.answer || pcs.has(viewerId)) return;
      const connRef = doc(db, 'streams', streamId, 'connections', viewerId);
      if (pcs.size >= MAX_VIEWERS) {
        await updateDoc(connRef, { full: true }).catch(() => {});
        return;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcs.set(viewerId, pc);
      media.getTracks().forEach((t) => pc.addTrack(t, media));
      pc.onicecandidate = (e) => {
        if (e.candidate) addDoc(collection(connRef, 'answerCandidates'), e.candidate.toJSON()).catch(() => {});
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(connRef, { answer: { type: answer.type, sdp: answer.sdp } });
      } catch {
        pc.close();
        pcs.delete(viewerId);
        return;
      }
      const unsubIce = onSnapshot(collection(connRef, 'offerCandidates'), (ice) => {
        ice.docChanges().forEach((c) => {
          if (c.type === 'added') pc.addIceCandidate(new RTCIceCandidate(c.doc.data())).catch(() => {});
        });
      });
      subs.push(unsubIce);
    });
  });
  subs.push(unsubConnections);

  return () => {
    subs.forEach((u) => u());
    pcs.forEach((pc) => pc.close());
    pcs.clear();
  };
}

// ---------- WebRTC: viewer side ----------

export function watchStream(
  streamId: string,
  viewerId: string,
  videoEl: HTMLVideoElement,
  onState: (s: 'connecting' | 'playing' | 'full' | 'failed') => void
): () => void {
  const { db } = firebase();
  const subs: Unsubscribe[] = [];
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const connRef = doc(db, 'streams', streamId, 'connections', viewerId);

  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.ontrack = (e) => {
    if (videoEl.srcObject !== e.streams[0]) {
      videoEl.srcObject = e.streams[0];
      videoEl.play().catch(() => {});
    }
    onState('playing');
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') onState('failed');
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) addDoc(collection(connRef, 'offerCandidates'), e.candidate.toJSON()).catch(() => {});
  };

  (async () => {
    try {
      // Clear any previous attempt by this viewer (e.g. a refresh).
      await deleteDoc(connRef).catch(() => {});
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await setDoc(connRef, { offer: { type: offer.type, sdp: offer.sdp }, createdAt: serverTimestamp() });
      const unsubAnswer = onSnapshot(connRef, async (snap) => {
        const data = snap.data();
        if (data?.full) {
          onState('full');
          return;
        }
        if (data?.answer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => onState('failed'));
        }
      });
      const unsubIce = onSnapshot(collection(connRef, 'answerCandidates'), (ice) => {
        ice.docChanges().forEach((c) => {
          if (c.type === 'added') pc.addIceCandidate(new RTCIceCandidate(c.doc.data())).catch(() => {});
        });
      });
      subs.push(unsubAnswer, unsubIce);
    } catch {
      onState('failed');
    }
  })();

  return () => {
    subs.forEach((u) => u());
    pc.close();
    deleteDoc(connRef).catch(() => {});
  };
}

// Old streams' signaling docs are cheap garbage; sweep is best-effort.
export async function cleanupConnections(streamId: string) {
  const { db } = firebase();
  const snap = await getDocs(collection(db, 'streams', streamId, 'connections')).catch(() => null);
  snap?.forEach((d) => deleteDoc(d.ref).catch(() => {}));
}

// A member's stream history for their profile page.
export async function listUserStreams(userId: string, max = 20): Promise<Stream[]> {
  const { db } = firebase();
  const snap = await getDocs(query(collection(db, 'streams'), where('hostId', '==', userId), limit(max)));
  const out: Stream[] = [];
  snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
  out.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  return out;
}
