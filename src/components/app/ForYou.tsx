import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import VerifyEmail from './VerifyEmail';
import MatchModal, { type MatchInfo } from './MatchModal';
import ReportDialog, { type ReportTarget } from './ReportDialog';
import { useAuth } from '../../lib/useAuth';
import { needsEmailVerification } from '../../lib/auth';
import { getProfile, type Profile } from '../../lib/profiles';
import { getBlockedIds } from '../../lib/blocking';
import { markOnline } from '../../lib/presence';
import {
  listVideoPosts, getLikeInfo, setLiked, getCommentCount, listComments, addComment,
  type Post, type PostComment,
} from '../../lib/posts';
import {
  getFollowingIds, follow, sendGift, getGiftCount, GIFT_TYPES, GIFT_EMOJI,
} from '../../lib/social';
import { isPaidGiftsEnabled, PAID_GIFTS, sendProfileGiftPaid } from '../../lib/wallet';
import { sendProfileGiftFree } from '../../lib/social';
import { recordSwipe, getSwipedIds } from '../../lib/matching';
import { useLang } from '../../i18n/react';

type LikeState = { count: number; likedByMe: boolean };

export default function ForYou() {
  const { d } = useLang();
  const F = d.app.foryou;
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [posts, setPosts] = React.useState<Post[] | null>(null);
  const [error, setError] = React.useState(false);
  const [likes, setLikes] = React.useState<Record<string, LikeState>>({});
  const [commentCounts, setCommentCounts] = React.useState<Record<string, number>>({});
  const [giftCounts, setGiftCounts] = React.useState<Record<string, number>>({});
  const [following, setFollowing] = React.useState<Set<string>>(new Set());
  const [swiped, setSwiped] = React.useState<Set<string>>(new Set());
  const [muted, setMuted] = React.useState(true);
  const [match, setMatch] = React.useState<MatchInfo | null>(null);
  const [report, setReport] = React.useState<ReportTarget | null>(null);

  // Per-post overlays
  const [openComments, setOpenComments] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<PostComment[]>([]);
  const [commentDraft, setCommentDraft] = React.useState('');
  const [giftPicker, setGiftPicker] = React.useState<string | null>(null);
  const [paidMode, setPaidMode] = React.useState(false);

  const videoRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());

  React.useEffect(() => {
    if (loading) return;
    if (!user) { window.location.href = '/login'; return; }
    if (needsEmailVerification(user)) return;
    markOnline(user.uid);
    (async () => {
      try {
        const [mine, vids, blocked, fol, sw] = await Promise.all([
          getProfile(user.uid),
          listVideoPosts(30),
          getBlockedIds(user.uid),
          getFollowingIds(user.uid).catch(() => new Set<string>()),
          getSwipedIds(user.uid).catch(() => new Set<string>()),
        ]);
        setMe(mine);
        setFollowing(fol);
        setSwiped(sw);
        const visible = vids.filter((p) => !blocked.has(p.authorId));
        setPosts(visible);
        visible.forEach(async (p) => {
          try {
            const [info, cc, gc] = await Promise.all([
              getLikeInfo(p.id, user.uid), getCommentCount(p.id), getGiftCount(p.id),
            ]);
            setLikes((s) => ({ ...s, [p.id]: info }));
            setCommentCounts((s) => ({ ...s, [p.id]: cc }));
            setGiftCounts((s) => ({ ...s, [p.id]: gc }));
          } catch {}
        });
      } catch {
        setError(true);
      }
    })();
    isPaidGiftsEnabled().then(setPaidMode);
  }, [user, loading]);

  // Autoplay the centred video, pause the rest.
  React.useEffect(() => {
    if (!posts || posts.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            v.muted = muted;
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: [0, 0.6, 1] }
    );
    videoRefs.current.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [posts, muted]);

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const cur = likes[postId] ?? { count: 0, likedByMe: false };
    const next = { count: cur.count + (cur.likedByMe ? -1 : 1), likedByMe: !cur.likedByMe };
    setLikes((s) => ({ ...s, [postId]: next }));
    try { await setLiked(postId, user.uid, next.likedByMe); }
    catch { setLikes((s) => ({ ...s, [postId]: cur })); }
  };

  const doFollow = async (authorId: string) => {
    if (!user || following.has(authorId)) return;
    setFollowing((s) => new Set(s).add(authorId));
    try { await follow(user.uid, authorId); }
    catch { setFollowing((s) => { const n = new Set(s); n.delete(authorId); return n; }); }
  };

  // The hybrid move: like the *person* from their video → Tinder swipe → match.
  const likePerson = async (authorId: string, authorName: string, authorPhoto?: string) => {
    if (!user || swiped.has(authorId)) return;
    setSwiped((s) => new Set(s).add(authorId));
    try {
      const res = await recordSwipe(user.uid, authorId, 'right');
      if (res.matched) setMatch({ name: res.matchedName || authorName, photo: authorPhoto, myPhoto: me?.images?.[0] });
    } catch {
      setSwiped((s) => { const n = new Set(s); n.delete(authorId); return n; });
    }
  };

  const openCommentsFor = async (postId: string) => {
    setOpenComments(postId);
    setComments([]);
    try { setComments(await listComments(postId)); } catch {}
  };

  const sendComment = async () => {
    const t = commentDraft.trim();
    if (!t || !user || !openComments) return;
    setCommentDraft('');
    try {
      const c = await addComment(openComments, { id: user.uid, name: me?.name || user.displayName || 'Member' }, t);
      setComments((cs) => [...cs, c]);
      setCommentCounts((s) => ({ ...s, [openComments]: (s[openComments] ?? 0) + 1 }));
    } catch { setCommentDraft(t); }
  };

  const giveGift = async (postId: string, authorId: string, type: string, price?: number) => {
    if (!user) return;
    setGiftPicker(null);
    setGiftCounts((s) => ({ ...s, [postId]: (s[postId] ?? 0) + 1 }));
    try {
      if (paidMode) {
        // Paid: coins → the creator's earnings via the trusted function.
        await sendProfileGiftPaid(authorId, type);
      } else {
        // Free: gift the person and bump the video's gift counter.
        await sendProfileGiftFree(authorId, { id: user.uid, name: me?.name || user.displayName || 'Member' }, type);
        await sendGift(postId, { id: user.uid, name: me?.name || user.displayName || 'Member' }, type as any).catch(() => {});
      }
    } catch {
      setGiftCounts((s) => ({ ...s, [postId]: Math.max(0, (s[postId] ?? 1) - 1) }));
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">{d.app.loading}</div>;
  if (needsEmailVerification(user)) return <VerifyEmail user={user} />;

  const railBtn = (label: string, onClick: () => void, icon: React.ReactNode, active = false, count?: number) => (
    <button onClick={onClick} aria-label={label} className="flex flex-col items-center gap-1 text-white">
      <span className={`w-11 h-11 rounded-full flex items-center justify-center ${active ? 'text-white' : 'text-white'}`} style={{ background: active ? 'var(--coral)' : 'rgba(0,0,0,0.35)' }}>
        {icon}
      </span>
      {typeof count === 'number' && count > 0 && <span className="text-[11px] font-semibold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{count}</span>}
    </button>
  );

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ink max-md:grid-cols-1">
      <div className="max-md:hidden"><Sidebar route="foryou" user={user} me={me} /></div>
      <main className="relative">
        {error ? (
          <div className="h-screen flex flex-col items-center justify-center text-white gap-4">
            <div>{F.loadFail}</div>
            <button onClick={() => window.location.reload()} className="btn btn-primary">{F.retry}</button>
          </div>
        ) : posts === null ? (
          <div className="h-screen flex items-center justify-center text-white/70">{d.app.loading}</div>
        ) : posts.length === 0 ? (
          <div className="h-screen flex flex-col items-center justify-center text-white gap-4 px-8 text-center">
            <div className="text-lg font-display font-semibold">{F.empty}</div>
            <a href="/app/community" className="btn btn-primary">{F.goPost}</a>
          </div>
        ) : (
          <div className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory">
            {posts.map((p) => {
              const mine = p.authorId === user.uid;
              const like = likes[p.id];
              return (
                <section key={p.id} className="h-[100dvh] snap-start relative flex items-center justify-center bg-black overflow-hidden">
                  <video
                    ref={(el) => { if (el) videoRefs.current.set(p.id, el); else videoRefs.current.delete(p.id); }}
                    src={p.videoUrl}
                    loop
                    playsInline
                    muted={muted}
                    onClick={() => setMuted((m) => !m)}
                    onDoubleClick={() => toggleLike(p.id)}
                    className="max-h-full max-w-full w-full h-full object-contain md:object-cover md:max-w-[480px]"
                  />
                  {muted && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-[11px] px-3 py-1 rounded-full bg-black/40 pointer-events-none">
                      🔇 {F.tapToUnmute}
                    </div>
                  )}

                  {/* Left: author + caption */}
                  <div className="absolute left-4 bottom-6 right-20 text-white md:left-1/2 md:-translate-x-[260px] md:w-[230px]">
                    <a href={`/app/profile?id=${p.authorId}`} className="flex items-center gap-2.5 mb-2">
                      <span className="w-10 h-10 rounded-full bg-cover bg-center flex items-center justify-center font-display font-semibold border-2 border-white" style={p.authorPhoto ? { backgroundImage: `url(${p.authorPhoto})` } : { background: 'var(--blush)', color: 'var(--ink)' }}>
                        {!p.authorPhoto && (p.authorName?.[0] || '?')}
                      </span>
                      <span className="font-semibold" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{p.authorName}</span>
                      {!mine && !following.has(p.authorId) && (
                        <button onClick={(e) => { e.preventDefault(); doFollow(p.authorId); }} className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--coral)' }}>
                          {F.follow}
                        </button>
                      )}
                    </a>
                    {p.text && <div className="text-[13px] leading-snug" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{p.text}</div>}
                  </div>

                  {/* Right action rail */}
                  <div className="absolute right-3 bottom-6 flex flex-col gap-4 items-center md:left-1/2 md:right-auto md:translate-x-[200px]">
                    {railBtn(F.like, () => toggleLike(p.id), <Icon.Heart size={22} filled={!!like?.likedByMe} />, !!like?.likedByMe, like?.count)}
                    {railBtn(F.comment, () => openCommentsFor(p.id), <Icon.Msg size={20} />, false, commentCounts[p.id])}
                    {railBtn(F.gift, () => setGiftPicker(giftPicker === p.id ? null : p.id), <span className="text-[20px] leading-none">🎁</span>, false, giftCounts[p.id])}
                    {!mine && (
                      swiped.has(p.authorId)
                        ? railBtn(F.matched, () => {}, <Icon.Check size={20} />, true)
                        : railBtn(F.likeProfile, () => likePerson(p.authorId, p.authorName, p.authorPhoto), <Icon.Star size={20} filled />, false)
                    )}
                    {!mine && railBtn('Report', () => setReport({ targetId: p.authorId, targetName: p.authorName }), <Icon.Flag size={18} />, false)}
                  </div>

                  {/* Gift picker */}
                  {giftPicker === p.id && !mine && (
                    <div className="absolute right-3 bottom-[340px] bg-white rounded-2xl p-2 shadow-xl flex gap-1 flex-wrap max-w-[180px] md:left-1/2 md:right-auto md:translate-x-[150px]">
                      {(paidMode ? PAID_GIFTS : GIFT_TYPES.map((t) => ({ type: t, emoji: GIFT_EMOJI[t], coins: 0 }))).map((g: any) => (
                        <button key={g.type} onClick={() => giveGift(p.id, p.authorId, g.type, g.coins)} className="flex flex-col items-center px-1.5 py-1 rounded-lg hover:bg-ivory">
                          <span className="text-[22px] leading-none">{g.emoji}</span>
                          {paidMode && <span className="text-[9px] text-muted">{g.coins}🪙</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Comments drawer */}
        {openComments && (
          <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setOpenComments(null)}>
            <div className="bg-white w-full max-w-[480px] rounded-t-3xl md:rounded-3xl max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-line flex items-center justify-between">
                <h3 className="font-display font-bold text-[18px] m-0">{F.comments}</h3>
                <button onClick={() => setOpenComments(null)} className="icon-btn" aria-label={d.app.report.close}><Icon.X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5 items-start">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center font-display font-semibold text-ink flex-shrink-0" style={{ background: 'var(--blush)' }}>{c.authorName?.[0]}</span>
                    <div className="bg-ivory rounded-2xl px-3.5 py-2 text-[13px] flex-1">
                      <a href={`/app/profile?id=${c.authorId}`} className="font-semibold hover:text-coral">{c.authorName}</a>
                      <div className="leading-snug">{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-line flex gap-2 items-center">
                <input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendComment()} placeholder={F.writeComment} className="flex-1 px-3.5 py-2.5 border border-line rounded-full bg-ivory text-sm outline-none focus:border-coral" />
                <button onClick={sendComment} disabled={!commentDraft.trim()} aria-label={F.send} className="w-10 h-10 rounded-full text-white flex items-center justify-center disabled:opacity-40" style={{ background: 'var(--coral)' }}><Icon.Send size={15} /></button>
              </div>
            </div>
          </div>
        )}
      </main>
      {match && <MatchModal match={match} d={d} onClose={() => setMatch(null)} />}
      {report && <ReportDialog reporterId={user.uid} target={report} d={d} onClose={() => setReport(null)} />}
    </div>
  );
}
