import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import VerifyEmail from './VerifyEmail';
import ReportDialog, { type ReportTarget } from './ReportDialog';
import { useAuth } from '../../lib/useAuth';
import { needsEmailVerification } from '../../lib/auth';
import { getProfile, type Profile } from '../../lib/profiles';
import { markOnline } from '../../lib/presence';
import { GIFT_TYPES, GIFT_EMOJI, type GiftType } from '../../lib/social';
import { isPaidGiftsEnabled, subscribeWallet, PAID_GIFTS, type Wallet } from '../../lib/wallet';
import {
  startStream, endStream, subscribeStream, subscribeLiveStreams, joinAsViewer, leaveAsViewer,
  subscribeViewerCount, subscribeStreamMessages, sendStreamMessage,
  sendStreamGiftFree, sendStreamGiftPaid, broadcast, watchStream, cleanupConnections,
  type Stream, type StreamMessage,
} from '../../lib/live';
import { useLang } from '../../i18n/react';

const ALL_EMOJI: Record<string, string> = { ...GIFT_EMOJI, diamond: '💎', castle: '🏰' };

export default function Live() {
  const { d } = useLang();
  const L = d.app.live;
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [report, setReport] = React.useState<ReportTarget | null>(null);

  const streamId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('id')
    : null;

  // Shared
  const [stream, setStream] = React.useState<Stream | null | undefined>(undefined);
  const [viewerCount, setViewerCount] = React.useState(0);
  const [messages, setMessages] = React.useState<StreamMessage[]>([]);
  const [chatText, setChatText] = React.useState('');
  const [paidMode, setPaidMode] = React.useState(false);
  const [wallet, setWallet] = React.useState<Wallet | null>(null);
  const [showGifts, setShowGifts] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const chatRef = React.useRef<HTMLDivElement>(null);

  // Host
  const [title, setTitle] = React.useState('');
  const [starting, setStarting] = React.useState(false);
  const [hostError, setHostError] = React.useState<string | null>(null);
  const [myStreamId, setMyStreamId] = React.useState<string | null>(null);
  const mediaRef = React.useRef<MediaStream | null>(null);
  const stopBroadcastRef = React.useRef<(() => void) | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Viewer
  const [viewState, setViewState] = React.useState<'connecting' | 'playing' | 'full' | 'failed'>('connecting');

  // Hub (no ?id= and not broadcasting): show everyone who's live.
  const [liveStreams, setLiveStreams] = React.useState<Stream[]>([]);
  React.useEffect(() => {
    if (streamId || myStreamId || !user || loading) return;
    return subscribeLiveStreams(setLiveStreams);
  }, [streamId, myStreamId, user, loading]);

  const activeId = streamId ?? myStreamId;
  const isHost = !!myStreamId || (!!stream && !!user && stream.hostId === user.uid);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (needsEmailVerification(user)) return;
    markOnline(user.uid);
    getProfile(user.uid).then(setMe).catch(() => {});
    isPaidGiftsEnabled().then((on) => setPaidMode(on));
  }, [user, loading]);

  React.useEffect(() => {
    if (!user || !paidMode) return;
    return subscribeWallet(user.uid, setWallet);
  }, [user, paidMode]);

  // Subscribe to the active stream doc + chat + viewer count.
  React.useEffect(() => {
    if (!activeId || !user) return;
    const u1 = subscribeStream(activeId, setStream);
    const u2 = subscribeStreamMessages(activeId, setMessages);
    const u3 = subscribeViewerCount(activeId, setViewerCount);
    return () => { u1(); u2(); u3(); };
  }, [activeId, user]);

  React.useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages.length]);

  // Viewer: presence + WebRTC subscription.
  React.useEffect(() => {
    if (!streamId || !user || loading || needsEmailVerification(user) || myStreamId) return;
    if (stream === undefined || stream === null || stream.status !== 'live' || stream.hostId === user.uid) return;
    joinAsViewer(streamId, { id: user.uid, name: me?.name || user.displayName || 'Member' }).catch(() => {});
    const video = videoRef.current;
    if (!video) return;
    const stop = watchStream(streamId, user.uid, video, setViewState);
    const onHide = () => leaveAsViewer(streamId, user.uid);
    window.addEventListener('pagehide', onHide);
    return () => {
      stop();
      window.removeEventListener('pagehide', onHide);
      leaveAsViewer(streamId, user.uid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId, user, loading, stream?.status === 'live']);

  const goLive = async () => {
    if (!user || starting) return;
    setHostError(null);
    setStarting(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      mediaRef.current = media;
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
      const id = await startStream(
        { id: user.uid, name: me?.name || user.displayName || 'Member', photo: me?.images?.[0] },
        title || L.titlePh
      );
      setMyStreamId(id);
      stopBroadcastRef.current = broadcast(id, media);
      try { window.history.replaceState(null, '', `?id=${id}`); } catch {}
    } catch (ex: any) {
      setHostError(ex?.name === 'NotAllowedError' || ex?.name === 'NotFoundError' ? L.cameraError : L.failed);
      mediaRef.current?.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
    } finally {
      setStarting(false);
    }
  };

  const stopLive = async () => {
    if (!myStreamId) return;
    if (!window.confirm(L.confirmStop)) return;
    stopBroadcastRef.current?.();
    stopBroadcastRef.current = null;
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
    await endStream(myStreamId).catch(() => {});
    cleanupConnections(myStreamId).catch(() => {});
    window.location.href = '/app/community';
  };

  // The host's <video> element only mounts after myStreamId is set (the
  // setup screen has no video tag), so attach the self-preview here rather
  // than inside goLive, where videoRef.current is still null.
  React.useEffect(() => {
    if (myStreamId && videoRef.current && mediaRef.current) {
      videoRef.current.srcObject = mediaRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [myStreamId]);

  // Best effort: end the stream if the host closes the tab.
  React.useEffect(() => {
    if (!myStreamId) return;
    const onHide = () => { endStream(myStreamId).catch(() => {}); };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [myStreamId]);

  const sendChat = async () => {
    const t = chatText.trim();
    if (!t || !user || !activeId) return;
    setChatText('');
    try {
      await sendStreamMessage(activeId, { id: user.uid, name: me?.name || user.displayName || 'Member' }, t);
    } catch {
      setChatText(t);
    }
  };

  const giveGift = async (type: string, price?: number) => {
    if (!user || !activeId) return;
    setShowGifts(false);
    try {
      if (paidMode) {
        if ((wallet?.coins ?? 0) < (price ?? 0)) {
          flash(d.app.wallet.insufficient);
          return;
        }
        await sendStreamGiftPaid(activeId, type);
      } else {
        await sendStreamGiftFree(activeId, { id: user.uid, name: me?.name || user.displayName || 'Member' }, type);
      }
    } catch (ex: any) {
      flash(String(ex?.message ?? '').includes('insufficient-coins') ? d.app.wallet.insufficient : d.app.wallet.giftFail);
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">{d.app.loading}</div>;
  if (needsEmailVerification(user)) return <VerifyEmail user={user} />;

  const setupMode = !streamId && !myStreamId;
  const endedMode = !!stream && stream.status === 'ended' && !myStreamId;

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
      <Sidebar route="live" user={user} me={me} />
      <main className="p-10 max-md:p-4">
        {toast && (
          <div className="mb-4 px-5 py-3 rounded-2xl text-white font-semibold shadow-lg max-w-[960px] mx-auto" style={{ background: 'linear-gradient(135deg, var(--forest), var(--coral))' }}>
            {toast}
          </div>
        )}

        {setupMode ? (
          <div className="max-w-[640px] mx-auto flex flex-col gap-5">
            <div>
              <div className="text-[11px] tracking-[0.1em] uppercase text-muted font-semibold mb-2">{L.liveNow}</div>
              {liveStreams.length === 0 ? (
                <div className="bg-white border border-line rounded-2xl p-6 text-center text-ink-soft text-sm">{L.nobodyLive}</div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2">
                  {liveStreams.map((s) => (
                    <a
                      key={s.id}
                      href={`/app/live?id=${s.id}`}
                      className="rounded-2xl overflow-hidden relative aspect-[3/4] bg-cover bg-center flex flex-col justify-end p-3"
                      style={s.hostPhoto ? { backgroundImage: `url(${s.hostPhoto})` } : { background: 'linear-gradient(135deg, var(--blush), var(--coral))' }}
                    >
                      <span className="absolute top-2.5 left-2.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-white animate-pulse" style={{ background: '#E0245E' }}>
                        {L.liveBadge}
                      </span>
                      <span className="text-white text-[14px] font-semibold truncate" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{s.hostName}</span>
                      <span className="text-white text-[11px] truncate opacity-90" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{s.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white border border-line rounded-2xl p-8">
              <h1 className="font-display font-bold text-[26px] m-0 mb-5">{L.startTitle}</h1>
              <div className="field mb-4">
                <label>{L.titleLabel}</label>
                <input maxLength={80} placeholder={L.titlePh} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              {hostError && <div className="text-sm px-3 py-2 rounded-lg mb-4" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{hostError}</div>}
              <button onClick={goLive} disabled={starting} className="btn btn-primary w-full justify-center disabled:opacity-60">
                <Icon.Camera size={16} /> {starting ? L.starting : L.start}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-[960px] mx-auto grid md:grid-cols-[1.4fr_1fr] gap-5 items-start">
            {/* Video panel */}
            <div className="bg-black rounded-2xl overflow-hidden relative aspect-[9/14] md:aspect-video">
              <video ref={videoRef} playsInline autoPlay className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 flex gap-2 items-center">
                {stream?.status === 'live' && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold text-white animate-pulse" style={{ background: '#E0245E' }}>{L.liveBadge}</span>
                )}
                <span className="px-2 py-0.5 rounded text-[11px] font-medium text-white bg-black/50">{L.viewers(viewerCount)}</span>
              </div>
              {stream && (
                <div className="absolute top-3 right-3 flex gap-2">
                  {!isHost && (
                    <button
                      onClick={() => setReport({ targetId: stream.hostId, targetName: stream.hostName })}
                      className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                      title={L.reportStream}
                      aria-label={L.reportStream}
                    >
                      <Icon.Flag size={13} />
                    </button>
                  )}
                </div>
              )}
              {(endedMode || (!isHost && viewState !== 'playing')) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white text-sm px-6 text-center">
                  {endedMode ? L.ended : viewState === 'full' ? L.full : viewState === 'failed' ? L.failed : L.waiting}
                  {(endedMode || viewState === 'full' || viewState === 'failed') && (
                    <a href="/app/community" className="btn btn-primary btn-sm">{L.backToCommunity}</a>
                  )}
                </div>
              )}
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                <div className="text-white min-w-0">
                  <div className="font-display font-semibold text-[16px] truncate" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{stream?.title}</div>
                  <div className="text-[12px] opacity-90" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{stream?.hostName}</div>
                </div>
                {isHost && stream?.status === 'live' && (
                  <button onClick={stopLive} className="btn btn-sm text-white flex-shrink-0" style={{ background: '#E0245E' }}>
                    {L.stop}
                  </button>
                )}
              </div>
            </div>

            {/* Chat panel */}
            <div className="bg-white border border-line rounded-2xl flex flex-col h-[460px]">
              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {messages.map((m) =>
                  m.type === 'gift' ? (
                    <div key={m.id} className="text-[13px] px-3 py-1.5 rounded-xl self-start font-medium" style={{ background: 'rgba(255,180,0,0.12)', color: '#8a6100' }}>
                      {L.giftLine(m.senderName, ALL_EMOJI[m.giftType ?? ''] ?? '🎁')}
                    </div>
                  ) : (
                    <div key={m.id} className="text-[13px] leading-snug">
                      <span className="font-semibold">{m.senderName}</span>{' '}
                      <span className="text-ink-soft">{m.text}</span>
                    </div>
                  )
                )}
              </div>
              {stream?.status === 'live' && (
                <div className="p-3 border-t border-line flex flex-col gap-2">
                  {showGifts && !isHost && (
                    <div className="flex gap-1 flex-wrap">
                      {paidMode
                        ? PAID_GIFTS.map((g) => (
                            <button key={g.type} onClick={() => giveGift(g.type, g.coins)} className="flex flex-col items-center px-1.5 py-0.5 rounded-lg hover:bg-ivory">
                              <span className="text-[20px] leading-none">{g.emoji}</span>
                              <span className="text-[9px] text-muted">{g.coins}🪙</span>
                            </button>
                          ))
                        : GIFT_TYPES.map((g: GiftType) => (
                            <button key={g} onClick={() => giveGift(g)} className="text-[20px] px-1.5 py-0.5 rounded-lg hover:bg-ivory">
                              {GIFT_EMOJI[g]}
                            </button>
                          ))}
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    {!isHost && (
                      <button onClick={() => setShowGifts((s) => !s)} className="text-[18px]" aria-label={d.app.community.sendGift} title={d.app.community.sendGift}>
                        🎁
                      </button>
                    )}
                    <input
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                      placeholder={L.chatPh}
                      className="flex-1 px-3.5 py-2 border border-line rounded-full bg-ivory text-[13px] outline-none focus:border-coral"
                    />
                    <button onClick={sendChat} disabled={!chatText.trim()} aria-label={d.app.community.sendComment} className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-40" style={{ background: 'var(--coral)' }}>
                      <Icon.Send size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      {report && <ReportDialog reporterId={user.uid} target={report} d={d} onClose={() => setReport(null)} />}
    </div>
  );
}
