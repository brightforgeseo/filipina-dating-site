import React from 'react';
import { joinCall, type AgoraSession } from '../../lib/agora';
import { AGORA_APP_ID, endCall, subscribeCall } from '../../lib/calls';

export default function CallOverlay({
  callId,
  otherName,
  role,
  onClose,
}: {
  callId: string;
  otherName: string;
  role: 'caller' | 'callee';
  onClose: () => void;
}) {
  const localRef = React.useRef<HTMLDivElement>(null);
  const remoteRef = React.useRef<HTMLDivElement>(null);
  const sessionRef = React.useRef<AgoraSession | null>(null);
  const closedRef = React.useRef(false);
  const [connected, setConnected] = React.useState(false);
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);
  const [error, setError] = React.useState('');

  const hangUp = React.useCallback(async () => {
    if (closedRef.current) return;
    closedRef.current = true;
    await sessionRef.current?.leave();
    sessionRef.current = null;
    await endCall(callId).catch(() => {});
    onClose();
  }, [callId, onClose]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!localRef.current || !remoteRef.current) return;
      try {
        const session = await joinCall({
          appId: AGORA_APP_ID,
          channel: callId,
          localEl: localRef.current,
          remoteEl: remoteRef.current,
          onRemoteJoined: () => setConnected(true),
          onRemoteLeft: () => hangUp(),
        });
        if (cancelled) {
          await session.leave();
          return;
        }
        sessionRef.current = session;
      } catch {
        setError('Could not access your camera or microphone.');
      }
    })();

    // If the other side declines/ends (or the doc disappears), close too.
    const unsub = subscribeCall(callId, (c) => {
      if (!c || c.status === 'ended' || c.status === 'declined' || c.status === 'missed') hangUp();
    });

    return () => {
      cancelled = true;
      unsub();
      sessionRef.current?.leave();
    };
  }, [callId, hangUp]);

  const toggleMic = () => {
    const v = !micOn;
    setMicOn(v);
    sessionRef.current?.setMic(v);
  };
  const toggleCam = () => {
    const v = !camOn;
    setCamOn(v);
    sessionRef.current?.setCam(v);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div ref={remoteRef} className="absolute inset-0 bg-black" />
      <div
        ref={localRef}
        className="absolute top-4 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-white/40 bg-black/60 z-10"
      />

      {(!connected || error) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 px-6 text-center">
          <div className="text-3xl font-display font-bold">{otherName}</div>
          <div className="text-white/70 mt-2">
            {error ? error : role === 'caller' ? 'Ringing…' : 'Connecting…'}
          </div>
        </div>
      )}

      <div className="absolute bottom-10 inset-x-0 flex justify-center gap-5 z-20">
        <button
          onClick={toggleMic}
          aria-label="Toggle microphone"
          className="w-14 h-14 rounded-full bg-white/15 text-white text-xl flex items-center justify-center backdrop-blur"
        >
          {micOn ? '🎙️' : '🔇'}
        </button>
        <button
          onClick={hangUp}
          aria-label="End call"
          className="w-16 h-16 rounded-full bg-red-600 text-white text-2xl flex items-center justify-center"
        >
          ✕
        </button>
        <button
          onClick={toggleCam}
          aria-label="Toggle camera"
          className="w-14 h-14 rounded-full bg-white/15 text-white text-xl flex items-center justify-center backdrop-blur"
        >
          {camOn ? '📹' : '🚫'}
        </button>
      </div>
    </div>
  );
}
