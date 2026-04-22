import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import { useAuth } from '../../lib/useAuth';
import { getProfile, type Profile } from '../../lib/profiles';
import {
  subscribeConversations,
  subscribeMessages,
  sendMessage,
  formatTime,
  type Conversation,
  type ChatMessage,
} from '../../lib/chat';

export default function Chat() {
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [conversations, setConversations] = React.useState<Conversation[] | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    getProfile(user.uid).then(setMe);
    const unsub = subscribeConversations(user.uid, (cs) => {
      setConversations(cs);
      setOpenId((prev) => prev ?? cs[0]?.matchId ?? null);
    });
    return () => unsub();
  }, [user, loading]);

  React.useEffect(() => {
    if (!openId) return;
    const unsub = subscribeMessages(openId, setMessages);
    return () => unsub();
  }, [openId]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || !openId || !user || sending) return;
    setSending(true);
    const toSend = text.trim();
    setText('');
    try {
      await sendMessage(openId, user.uid, toSend);
    } catch {
      setText(toSend);
    } finally {
      setSending(false);
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">Loading…</div>;

  const active = conversations?.find((c) => c.matchId === openId);

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
      <Sidebar route="chat" user={user} me={me} />
      <main>
        <div className="grid grid-cols-[340px_1fr] h-screen max-md:grid-cols-1">
          <aside className="border-r border-line overflow-y-auto bg-white">
            <div className="sticky top-0 px-5 py-6 border-b border-line bg-white z-10">
              <h2 className="font-display font-bold text-[26px] m-0 tracking-[-0.015em]">Messages</h2>
            </div>
            {conversations === null ? (
              <div className="p-8 text-center text-muted">Loading…</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="font-semibold mb-2">No conversations yet</div>
                <div className="text-sm text-ink-soft mb-4">Match with someone to start chatting.</div>
                <a href="/app" className="btn btn-primary btn-sm">Find matches</a>
              </div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.matchId}
                  onClick={() => setOpenId(c.matchId)}
                  className={`flex gap-3 px-5 py-3.5 border-b border-line cursor-pointer items-center ${openId === c.matchId ? 'bg-ivory' : 'hover:bg-ivory/60'}`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-display font-semibold text-ink relative flex-shrink-0" style={{ background: c.otherPhoto ? `url(${c.otherPhoto}) center/cover` : 'var(--blush)' }}>
                    {!c.otherPhoto && c.otherName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm truncate ${c.unreadCount ? 'font-semibold' : ''}`}>{c.otherName}</span>
                      <span className="text-[11px] text-muted flex-shrink-0 ml-2">{formatTime(c.lastMessageTime)}</span>
                    </div>
                    <div className="text-[13px] text-ink-soft truncate flex items-center gap-1.5">
                      {c.lastMessage || 'Say hi!'}
                      {c.unreadCount > 0 && <span className="text-[10px] bg-coral text-white px-1.5 py-0.5 rounded-full font-semibold ml-auto flex-shrink-0">{c.unreadCount}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </aside>

          <section className="flex flex-col bg-ivory">
            {active ? (
              <>
                <div className="flex items-center gap-3.5 px-6 py-4 border-b border-line backdrop-blur-md bg-white/80">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-display font-semibold text-ink" style={{ background: active.otherPhoto ? `url(${active.otherPhoto}) center/cover` : 'var(--blush)' }}>
                    {!active.otherPhoto && active.otherName?.[0]}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-[20px] m-0">{active.otherName}</h3>
                    {active.unreadCount > 0 && <div className="text-xs text-coral">{active.unreadCount} new</div>}
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button className="icon-btn" title="Translate"><Icon.Translate size={16} /></button>
                    <button className="icon-btn" title="Video call"><Icon.Video size={16} /></button>
                    <button className="icon-btn"><Icon.More size={16} /></button>
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-2.5">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted my-10 text-sm">Say hi — this is the start of your conversation.</div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderId === user.uid;
                      return (
                        <div key={m.id} className={`flex max-w-[70%] ${mine ? 'self-end flex-row-reverse' : 'self-start'}`}>
                          <div>
                            <div
                              className={`px-4 py-2.5 rounded-2xl text-sm leading-[1.45] ${mine ? 'text-white rounded-br-sm' : 'bg-white border border-line rounded-bl-sm'}`}
                              style={mine ? { background: 'var(--coral)' } : {}}
                            >
                              {m.text || (m.imageUrl ? '📷 Photo' : m.videoUrl ? '🎥 Video' : '')}
                            </div>
                            <div className={`text-[10px] text-muted mt-1 ${mine ? 'text-right' : 'text-left'}`}>{formatTime(m.timestamp)}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="px-6 py-4 border-t border-line flex gap-2.5 items-center bg-white">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !sending && send()}
                    placeholder="Type a message…"
                    className="flex-1 px-4 py-3 border border-line rounded-full bg-ivory text-sm outline-none focus:border-coral"
                  />
                  <button onClick={send} disabled={sending || !text.trim()} className="w-[44px] h-[44px] rounded-full text-white flex items-center justify-center border-0 disabled:opacity-40" style={{ background: 'var(--coral)' }}>
                    <Icon.Send size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted">
                {conversations && conversations.length === 0 ? 'No conversations yet.' : 'Select a conversation'}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
