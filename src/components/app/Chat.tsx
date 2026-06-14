import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import VerifyEmail from './VerifyEmail';
import { useAuth } from '../../lib/useAuth';
import { needsEmailVerification } from '../../lib/auth';
import { getProfile, type Profile } from '../../lib/profiles';
import { blockUser, getBlockedIds, unmatch } from '../../lib/blocking';
import { markOnline } from '../../lib/presence';
import {
  subscribeConversations,
  subscribeMessages,
  sendMessage,
  sendImageMessage,
  sendVideoMessage,
  setTyping,
  subscribeTyping,
  markMessagesRead,
  formatTime,
  type Conversation,
  type ChatMessage,
} from '../../lib/chat';
import { uploadChatImage, uploadChatVideo } from '../../lib/storage';
import { hasScamSignals } from '../../lib/safety';
import { translateText } from '../../lib/translate';
import ReportDialog, { type ReportTarget } from './ReportDialog';
import CallOverlay from './CallOverlay';
import {
  AGORA_APP_ID,
  acceptCall,
  createCall,
  declineCall,
  subscribeIncomingCalls,
  type CallDoc,
} from '../../lib/calls';
import { useLang } from '../../i18n/react';

export default function Chat() {
  const { d, lang } = useLang();
  const C = d.app.chat;
  const time = d.app.time;
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [conversations, setConversations] = React.useState<Conversation[] | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [report, setReport] = React.useState<ReportTarget | null>(null);
  const [incoming, setIncoming] = React.useState<CallDoc | null>(null);
  const [activeCall, setActiveCall] = React.useState<{ id: string; otherName: string; role: 'caller' | 'callee' } | null>(null);
  const callable = !!AGORA_APP_ID;
  const [otherTyping, setOtherTyping] = React.useState(false);
  const [translated, setTranslated] = React.useState<Record<string, string>>({});
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const autoSelected = React.useRef(false);
  const blockedRef = React.useRef<Set<string>>(new Set());
  const typingSentRef = React.useRef(0);
  const typingIdleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (needsEmailVerification(user)) return;
    markOnline(user.uid);
    getProfile(user.uid).then(setMe);
    getBlockedIds(user.uid)
      .then((ids) => {
        blockedRef.current = ids;
        setConversations((cs) => (cs ? cs.filter((c) => !ids.has(c.otherId)) : cs));
      })
      .catch(() => {});
    const unsub = subscribeConversations(user.uid, (raw) => {
      const cs = raw.filter((c) => !blockedRef.current.has(c.otherId));
      setConversations(cs);
      // Auto-open the latest conversation once, desktop only — on mobile the
      // list and the thread are separate screens, so start on the list.
      if (!autoSelected.current) {
        autoSelected.current = true;
        if (window.matchMedia('(min-width: 768px)').matches) {
          setOpenId((prev) => prev ?? cs[0]?.matchId ?? null);
        }
      }
    });
    return () => unsub();
  }, [user, loading]);

  React.useEffect(() => {
    if (!openId || !user) return;
    const unsub = subscribeMessages(openId, (msgs) => {
      setMessages(msgs);
      const unreadFrom = msgs.find((m) => m.senderId !== user.uid && !m.isRead)?.senderId;
      if (unreadFrom) markMessagesRead(openId, unreadFrom).catch(() => {});
      // The open conversation is read by definition — zero it unconditionally,
      // since a conversation-list refetch can race the read-receipt batch and
      // restore a stale count with no later event to clear it.
      setConversations((cs) =>
        cs ? cs.map((c) => (c.matchId === openId && c.unreadCount ? { ...c, unreadCount: 0 } : c)) : cs
      );
    });
    return () => unsub();
  }, [openId, user]);

  // Resolve the other member's id without re-subscribing on every conversations
  // mutation (the list churns on each incoming message); only the id matters.
  const openOtherId = React.useMemo(
    () => conversations?.find((c) => c.matchId === openId)?.otherId ?? null,
    [conversations, openId],
  );

  // Show the other member's typing state, with a client-side auto-clear so a
  // stale `true` left by a crashed/closed peer (no further snapshot) goes away.
  React.useEffect(() => {
    setOtherTyping(false);
    if (!openId || !user || !openOtherId) return;
    const onTyping = (t: boolean) => {
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
      setOtherTyping(t);
      if (t) typingClearRef.current = setTimeout(() => setOtherTyping(false), 6000);
    };
    const unsub = subscribeTyping(openId, openOtherId, onTyping);
    return () => {
      unsub();
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
    };
  }, [openId, user, openOtherId]);

  const handleTyping = () => {
    if (!openId || !user) return;
    const now = Date.now();
    if (now - typingSentRef.current > 2500) {
      typingSentRef.current = now;
      setTyping(openId, user.uid, true).catch(() => {});
    }
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    typingIdleRef.current = setTimeout(() => stopTyping(), 4000);
  };

  const stopTyping = () => {
    if (typingIdleRef.current) {
      clearTimeout(typingIdleRef.current);
      typingIdleRef.current = null;
    }
    typingSentRef.current = 0;
    if (openId && user) setTyping(openId, user.uid, false).catch(() => {});
  };

  // Cached translations are language-specific; drop them when the UI language
  // changes so a stale prior-language translation isn't shown.
  React.useEffect(() => {
    setTranslated({});
  }, [lang]);

  const doTranslate = async (m: ChatMessage) => {
    if (translated[m.id]) {
      setTranslated((t) => {
        const n = { ...t };
        delete n[m.id];
        return n;
      });
      return;
    }
    if (!m.text) return;
    const out = await translateText(m.text, lang).catch(() => null);
    if (out && out !== m.text) setTranslated((t) => ({ ...t, [m.id]: out }));
  };

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Listen for incoming calls to me (ignored while already in a call).
  React.useEffect(() => {
    if (!user || !callable) return;
    const unsub = subscribeIncomingCalls(user.uid, (call) => {
      setActiveCall((cur) => {
        if (!cur) setIncoming(call);
        return cur;
      });
    });
    return () => unsub();
  }, [user, callable]);

  const startCall = async () => {
    if (!active || !user || !me || !callable) return;
    try {
      const id = await createCall(
        { id: user.uid, name: me.name || 'Member', photo: me.images?.find(Boolean) },
        { calleeId: active.otherId, matchId: active.matchId, calleeName: active.otherName, calleePhoto: active.otherPhoto },
      );
      setActiveCall({ id, otherName: active.otherName, role: 'caller' });
    } catch {
      window.alert('Could not start the call.');
    }
  };

  const acceptIncoming = async () => {
    if (!incoming) return;
    const call = incoming;
    setIncoming(null);
    await acceptCall(call.id).catch(() => {});
    setActiveCall({ id: call.id, otherName: call.callerName, role: 'callee' });
  };

  const declineIncoming = async () => {
    if (!incoming) return;
    await declineCall(incoming.id).catch(() => {});
    setIncoming(null);
  };

  const send = async () => {
    if (!text.trim() || !openId || !user || sending) return;
    setSending(true);
    const toSend = text.trim();
    setText('');
    stopTyping();
    try {
      await sendMessage(openId, user.uid, toSend);
    } catch {
      setText(toSend);
    } finally {
      setSending(false);
    }
  };

  const sendPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !openId || !user || sending) return;
    setSending(true);
    try {
      const url = await uploadChatImage(user.uid, file);
      await sendImageMessage(openId, user.uid, url);
    } catch (ex: any) {
      window.alert(ex?.code ? `${C.photoFail} (${ex.code})` : C.photoFail);
    } finally {
      setSending(false);
    }
  };

  const sendVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !openId || !user || sending) return;
    setSending(true);
    try {
      const url = await uploadChatVideo(openId, file);
      await sendVideoMessage(openId, user.uid, url);
    } catch (ex: any) {
      window.alert(ex?.code ? `${C.photoFail} (${ex.code})` : C.photoFail);
    } finally {
      setSending(false);
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">{d.app.loading}</div>;
  if (needsEmailVerification(user)) return <VerifyEmail user={user} />;

  const active = conversations?.find((c) => c.matchId === openId);

  const removeConversation = (matchId: string) => {
    setConversations((cs) => (cs ? cs.filter((c) => c.matchId !== matchId) : cs));
    setOpenId(null);
  };

  const doUnmatch = async () => {
    if (!active) return;
    if (!window.confirm(C.unmatchConfirm(active.otherName))) return;
    const id = active.matchId;
    removeConversation(id);
    try {
      await unmatch(id);
    } catch {
      window.alert(C.unmatchFail);
      window.location.reload();
    }
  };

  const doBlock = async () => {
    if (!active) return;
    if (!window.confirm(C.blockConfirm(active.otherName))) return;
    const id = active.matchId;
    const otherId = active.otherId;
    removeConversation(id);
    try {
      await blockUser(user.uid, otherId);
      blockedRef.current.add(otherId);
      await unmatch(id).catch(() => {});
    } catch {
      window.alert(C.blockFail);
      window.location.reload();
    }
  };

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1 max-md:grid-rows-[auto_1fr] max-md:h-dvh max-md:min-h-0">
      <Sidebar route="chat" user={user} me={me} />
      <main className="max-md:min-h-0">
        <div className="grid grid-cols-[340px_1fr] h-screen max-md:grid-cols-1 max-md:h-full">
          <aside className={`border-r border-line overflow-y-auto bg-white ${openId ? 'max-md:hidden' : ''}`}>
            <div className="sticky top-0 px-5 py-6 border-b border-line bg-white z-10">
              <h2 className="font-display font-bold text-[26px] m-0 tracking-[-0.015em]">{C.title}</h2>
            </div>
            {conversations === null ? (
              <div className="p-8 text-center text-muted">{d.app.loading}</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="font-semibold mb-2">{C.emptyTitle}</div>
                <div className="text-sm text-ink-soft mb-4">{C.emptyBody}</div>
                <a href="/app" className="btn btn-primary btn-sm">{C.findMatches}</a>
              </div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.matchId}
                  onClick={() => setOpenId(c.matchId)}
                  className={`flex gap-3 px-5 py-3.5 border-b border-line cursor-pointer items-center ${openId === c.matchId ? 'bg-ivory' : 'hover:bg-ivory/60'}`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-display font-semibold text-ink relative flex-shrink-0 overflow-hidden" style={{ background: 'var(--blush)' }}>
                    {c.otherPhoto ? <img src={c.otherPhoto} alt={c.otherName || ''} loading="lazy" className="absolute inset-0 w-full h-full object-cover" /> : c.otherName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm truncate ${c.unreadCount ? 'font-semibold' : ''}`}>{c.otherName}</span>
                      <span className="text-[11px] text-muted flex-shrink-0 ml-2">{formatTime(c.lastMessageTime, time)}</span>
                    </div>
                    <div className="text-[13px] text-ink-soft truncate flex items-center gap-1.5">
                      {c.lastMessage || C.sayHi}
                      {c.unreadCount > 0 && <span className="text-[10px] bg-coral text-white px-1.5 py-0.5 rounded-full font-semibold ml-auto flex-shrink-0">{c.unreadCount}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </aside>

          <section className={`flex flex-col bg-ivory ${!openId ? 'max-md:hidden' : ''}`}>
            {active ? (
              <>
                <div className="flex items-center gap-3.5 px-6 py-4 border-b border-line backdrop-blur-md bg-white/80 max-md:px-4 max-md:gap-2.5">
                  <button onClick={() => setOpenId(null)} className="hidden max-md:inline-flex icon-btn" aria-label={C.back}>
                    <span className="rotate-180 inline-flex"><Icon.Arrow /></span>
                  </button>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-display font-semibold text-ink relative overflow-hidden flex-shrink-0" style={{ background: 'var(--blush)' }}>
                    {active.otherPhoto ? <img src={active.otherPhoto} alt={active.otherName || ''} loading="lazy" className="absolute inset-0 w-full h-full object-cover" /> : active.otherName?.[0]}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-[20px] m-0">{active.otherName}</h3>
                    {otherTyping ? (
                      <div className="text-xs text-coral">{C.typing}</div>
                    ) : active.unreadCount > 0 ? (
                      <div className="text-xs text-coral">{C.newCount(active.unreadCount)}</div>
                    ) : null}
                  </div>
                  <div className="ml-auto flex gap-2">
                    {callable && (
                      <button onClick={startCall} className="icon-btn text-base leading-none" title="Video call" aria-label="Video call">
                        📹
                      </button>
                    )}
                    <button onClick={doUnmatch} className="icon-btn" title={C.unmatch} aria-label={C.unmatch}>
                      <Icon.X size={14} />
                    </button>
                    <button onClick={doBlock} className="icon-btn" title={C.block} aria-label={C.block}>
                      <Icon.Ban size={14} />
                    </button>
                    <button
                      onClick={() => setReport({ targetId: active.otherId, targetName: active.otherName, matchId: active.matchId })}
                      className="icon-btn"
                      title={C.report}
                      aria-label={C.report}
                    >
                      <Icon.Flag size={14} />
                    </button>
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-2.5">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted my-10 text-sm">{C.startOfConvo}</div>
                  ) : (
                    (() => {
                      const lastMine = [...messages].reverse().find((m) => m.senderId === user.uid);
                      return messages.map((m) => {
                        const mine = m.senderId === user.uid;
                        return (
                          <div key={m.id} className={`flex max-w-[70%] ${mine ? 'self-end flex-row-reverse' : 'self-start'}`}>
                            <div>
                              {m.imageUrl ? (
                                <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className={`block rounded-2xl overflow-hidden border ${mine ? 'border-transparent rounded-br-sm' : 'border-line rounded-bl-sm'}`}>
                                  <img src={m.imageUrl} alt={C.photo} className="block max-w-[220px] max-h-[280px] object-cover" loading="lazy" />
                                </a>
                              ) : m.videoUrl ? (
                                <video
                                  src={m.videoUrl}
                                  controls
                                  playsInline
                                  className={`block max-w-[220px] max-h-[280px] rounded-2xl border ${mine ? 'border-transparent rounded-br-sm' : 'border-line rounded-bl-sm'}`}
                                />
                              ) : (
                                <div
                                  className={`px-4 py-2.5 rounded-2xl text-sm leading-[1.45] ${mine ? 'text-white rounded-br-sm' : 'bg-white border border-line rounded-bl-sm'}`}
                                  style={mine ? { background: 'var(--coral)' } : {}}
                                >
                                  {translated[m.id] || m.text || ''}
                                </div>
                              )}
                              <div className={`text-[10px] text-muted mt-1 ${mine ? 'text-right' : 'text-left'}`}>
                                {formatTime(m.timestamp, time)}
                                {mine && m.id === lastMine?.id && m.isRead ? ` · ${C.seen}` : ''}
                                {!mine && m.text && (
                                  <>
                                    {' · '}
                                    <button onClick={() => doTranslate(m)} className="text-coral hover:underline">
                                      {translated[m.id] ? C.showOriginal : C.translate}
                                    </button>
                                  </>
                                )}
                              </div>
                              {!mine && hasScamSignals(m.text) && active && (
                                <div className="mt-1 px-3 py-2 rounded-xl text-[11px] leading-snug max-w-[260px]" style={{ background: 'rgba(255,180,0,0.12)', color: '#8a6100', border: '1px solid rgba(255,180,0,0.3)' }}>
                                  ⚠️ {C.scamWarning}{' '}
                                  <button
                                    onClick={() => setReport({ targetId: active.otherId, targetName: active.otherName, defaultReason: 'money', matchId: active.matchId, messageId: m.id, messageText: m.text })}
                                    className="font-semibold underline underline-offset-2"
                                  >
                                    {C.reportMessage}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
                <div className="px-6 py-4 border-t border-line flex gap-2.5 items-center bg-white max-md:px-4">
                  <label className="icon-btn cursor-pointer flex-shrink-0" title={C.sendPhoto} aria-label={C.sendPhoto}>
                    <Icon.Camera size={16} />
                    <input type="file" accept="image/*" onChange={sendPhoto} disabled={sending} className="hidden" />
                  </label>
                  <label className="icon-btn cursor-pointer flex-shrink-0 text-base leading-none" title={C.video} aria-label={C.video}>
                    🎥
                    <input type="file" accept="video/*" onChange={sendVideo} disabled={sending} className="hidden" />
                  </label>
                  <input
                    value={text}
                    onChange={(e) => { setText(e.target.value); handleTyping(); }}
                    onKeyDown={(e) => e.key === 'Enter' && !sending && send()}
                    placeholder={C.typeMessage}
                    className="flex-1 px-4 py-3 border border-line rounded-full bg-ivory text-sm outline-none focus:border-coral"
                  />
                  <button onClick={send} disabled={sending || !text.trim()} aria-label={C.send} className="w-[44px] h-[44px] rounded-full text-white flex items-center justify-center border-0 disabled:opacity-40" style={{ background: 'var(--coral)' }}>
                    <Icon.Send size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted">
                {conversations && conversations.length === 0 ? C.noConvos : C.selectConvo}
              </div>
            )}
          </section>
        </div>
      </main>
      {report && <ReportDialog reporterId={user.uid} target={report} d={d} onClose={() => setReport(null)} />}

      {incoming && !activeCall && (
        <div className="fixed inset-0 z-[55] bg-black/60 flex items-center justify-center p-6">
          <div className="card p-6 text-center max-w-xs w-full">
            <div className="text-4xl mb-2">📹</div>
            <div className="font-display font-bold text-xl">{incoming.callerName}</div>
            <div className="text-sm text-ink-soft mb-5">is calling you…</div>
            <div className="flex gap-3 justify-center">
              <button onClick={declineIncoming} className="btn btn-ghost flex-1 justify-center">Decline</button>
              <button onClick={acceptIncoming} className="btn btn-primary flex-1 justify-center">Accept</button>
            </div>
          </div>
        </div>
      )}

      {activeCall && (
        <CallOverlay
          callId={activeCall.id}
          otherName={activeCall.otherName}
          role={activeCall.role}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}
