import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import VerifyEmail from './VerifyEmail';
import ReportDialog, { type ReportTarget } from './ReportDialog';
import { useAuth } from '../../lib/useAuth';
import { needsEmailVerification } from '../../lib/auth';
import { getProfile, type Profile } from '../../lib/profiles';
import { getBlockedIds } from '../../lib/blocking';
import { markOnline } from '../../lib/presence';
import { formatTime } from '../../lib/chat';
import {
  listPosts, listGroupPosts, createPost, deletePost, uploadPostMedia,
  getLikeInfo, setLiked, getCommentCount, listComments, addComment,
  type Post, type PostComment,
} from '../../lib/posts';
import { getFollowingIds, sendGift, getGiftCount, GIFT_TYPES, GIFT_EMOJI, type GiftType } from '../../lib/social';
import {
  isPaidGiftsEnabled, subscribeWallet, startCoinCheckout, sendPaidGiftFn, requestPayoutFn,
  COIN_PACKAGES, PAID_GIFTS, PAYOUT_USD_PER_COIN, MIN_PAYOUT_COINS, type Wallet,
} from '../../lib/wallet';
import {
  listGroups, createGroup, getGroup, joinGroup, leaveGroup, getMyGroupIds, getMemberCount,
  type Group,
} from '../../lib/groups';
import { useLang } from '../../i18n/react';

type LikeState = { count: number; likedByMe: boolean };

export default function Community() {
  const { d } = useLang();
  const C = d.app.community;
  const time = d.app.time;
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [error, setError] = React.useState<'rules' | 'network' | null>(null);
  const [report, setReport] = React.useState<ReportTarget | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  // Paid gifting (Phase 2) — off until config/app.paidGiftsEnabled is true.
  const [paidMode, setPaidMode] = React.useState(false);
  const [wallet, setWallet] = React.useState<Wallet | null>(null);
  const [showBuy, setShowBuy] = React.useState(false);
  const [buyBusy, setBuyBusy] = React.useState<string | null>(null);
  const [showPayout, setShowPayout] = React.useState(false);
  const [gcash, setGcash] = React.useState('');
  const [payoutBusy, setPayoutBusy] = React.useState(false);
  const [payoutDone, setPayoutDone] = React.useState(false);
  const [payoutErr, setPayoutErr] = React.useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Feed
  const [posts, setPosts] = React.useState<Post[] | null>(null);
  const [likes, setLikes] = React.useState<Record<string, LikeState>>({});
  const [commentCounts, setCommentCounts] = React.useState<Record<string, number>>({});
  const [giftCounts, setGiftCounts] = React.useState<Record<string, number>>({});
  const [giftPicker, setGiftPicker] = React.useState<string | null>(null);
  const [openComments, setOpenComments] = React.useState<Record<string, PostComment[]>>({});
  const [commentDrafts, setCommentDrafts] = React.useState<Record<string, string>>({});
  const [feedFilter, setFeedFilter] = React.useState<'all' | 'following'>('all');
  const [followingIds, setFollowingIds] = React.useState<Set<string>>(new Set());

  // Tabs / groups
  const [view, setView] = React.useState<'feed' | 'groups'>('feed');
  const [groups, setGroups] = React.useState<Group[] | null>(null);
  const [myGroupIds, setMyGroupIds] = React.useState<Set<string>>(new Set());
  const [memberCounts, setMemberCounts] = React.useState<Record<string, number>>({});
  const [activeGroup, setActiveGroup] = React.useState<Group | null>(null);
  const [groupPosts, setGroupPosts] = React.useState<Post[] | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [gName, setGName] = React.useState('');
  const [gDesc, setGDesc] = React.useState('');
  const [gBusy, setGBusy] = React.useState(false);
  const [gErr, setGErr] = React.useState<string | null>(null);

  // Composer (shared between main feed and the open group)
  const [text, setText] = React.useState('');
  const [media, setMedia] = React.useState<{ imageUrl?: string; videoUrl?: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [posting, setPosting] = React.useState(false);
  const [composerErr, setComposerErr] = React.useState<string | null>(null);

  const blockedRef = React.useRef<Set<string>>(new Set());

  const loadPostMeta = React.useCallback((list: Post[], uid: string) => {
    list.forEach(async (p) => {
      try {
        const [info, cc, gc] = await Promise.all([
          getLikeInfo(p.id, uid),
          getCommentCount(p.id),
          getGiftCount(p.id),
        ]);
        setLikes((s) => ({ ...s, [p.id]: info }));
        setCommentCounts((s) => ({ ...s, [p.id]: cc }));
        setGiftCounts((s) => ({ ...s, [p.id]: gc }));
      } catch {}
    });
  }, []);

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (needsEmailVerification(user)) return;
    markOnline(user.uid);
    (async () => {
      try {
        const [mine, all, blocked, following, allGroups, myGids] = await Promise.all([
          getProfile(user.uid),
          listPosts(30),
          getBlockedIds(user.uid),
          getFollowingIds(user.uid).catch(() => new Set<string>()),
          listGroups(50).catch(() => [] as Group[]),
          getMyGroupIds(user.uid).catch(() => new Set<string>()),
        ]);
        setMe(mine);
        blockedRef.current = blocked;
        const visible = all.filter((p) => !blocked.has(p.authorId));
        setPosts(visible);
        setFollowingIds(following);
        setGroups(allGroups);
        setMyGroupIds(myGids);
        loadPostMeta(visible, user.uid);
        allGroups.forEach(async (g) => {
          try {
            const n = await getMemberCount(g.id);
            setMemberCounts((s) => ({ ...s, [g.id]: n }));
          } catch {}
        });
        // Deep link: /app/community?group=<id>
        const params = new URLSearchParams(window.location.search);
        const gid = params.get('group');
        if (gid) {
          const g = allGroups.find((x) => x.id === gid) ?? (await getGroup(gid).catch(() => null));
          if (g) openGroup(g, user.uid);
        }
        if (params.get('coins') === 'success') {
          flash(d.app.wallet.purchaseSuccess);
          try { window.history.replaceState(null, '', window.location.pathname); } catch {}
        }
      } catch (ex: any) {
        setError(ex?.code === 'permission-denied' ? 'rules' : 'network');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  React.useEffect(() => {
    if (!user || loading || needsEmailVerification(user)) return;
    let unsub: (() => void) | undefined;
    isPaidGiftsEnabled().then((on) => {
      setPaidMode(on);
      if (on) unsub = subscribeWallet(user.uid, setWallet);
    });
    return () => unsub?.();
  }, [user, loading]);

  const openGroup = async (g: Group, uid?: string) => {
    setActiveGroup(g);
    setView('groups');
    setGroupPosts(null);
    setText('');
    setMedia(null);
    setComposerErr(null);
    try {
      window.history.replaceState(null, '', `?group=${g.id}`);
    } catch {}
    try {
      const list = (await listGroupPosts(g.id, 30)).filter((p) => !blockedRef.current.has(p.authorId));
      setGroupPosts(list);
      if (user) loadPostMeta(list, (uid ?? user.uid));
    } catch {
      setGroupPosts([]);
    }
  };

  const closeGroup = () => {
    setActiveGroup(null);
    setGroupPosts(null);
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {}
  };

  const toggleMembership = async (g: Group) => {
    if (!user) return;
    const joined = myGroupIds.has(g.id);
    setMyGroupIds((s) => {
      const n = new Set(s);
      joined ? n.delete(g.id) : n.add(g.id);
      return n;
    });
    setMemberCounts((s) => ({ ...s, [g.id]: Math.max(0, (s[g.id] ?? 0) + (joined ? -1 : 1)) }));
    try {
      if (joined) await leaveGroup(g.id, user.uid);
      else await joinGroup(g.id, { id: user.uid, name: me?.name || user.displayName || 'Member' });
    } catch {
      setMyGroupIds((s) => {
        const n = new Set(s);
        joined ? n.add(g.id) : n.delete(g.id);
        return n;
      });
      setMemberCounts((s) => ({ ...s, [g.id]: Math.max(0, (s[g.id] ?? 0) + (joined ? 1 : -1)) }));
      window.alert(C.errJoin);
    }
  };

  const submitGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || gBusy || !gName.trim()) return;
    setGErr(null);
    setGBusy(true);
    try {
      const g = await createGroup({ id: user.uid, name: me?.name || user.displayName || 'Member' }, gName, gDesc);
      setGroups((gs) => (gs ? [g, ...gs] : [g]));
      setMyGroupIds((s) => new Set(s).add(g.id));
      setMemberCounts((s) => ({ ...s, [g.id]: 1 }));
      setShowCreate(false);
      setGName('');
      setGDesc('');
      openGroup(g);
    } catch (ex: any) {
      setGErr(ex?.code === 'permission-denied' ? d.app.rulesHint : C.errGroup);
    } finally {
      setGBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setComposerErr(null);
    setUploading(true);
    try {
      setMedia(await uploadPostMedia(user.uid, file));
    } catch (ex: any) {
      if (ex?.message === 'not-media') setComposerErr(C.errNotMedia);
      else if (ex?.message === 'too-large') setComposerErr(C.errMediaTooLarge);
      else if (ex?.code === 'storage/unauthorized' || ex?.code === 'storage/unknown') setComposerErr(d.app.profile.edit.errStorageRules);
      else setComposerErr(C.errPost);
    } finally {
      setUploading(false);
    }
  };

  const publish = async () => {
    if (!user || posting || (!text.trim() && !media)) return;
    setComposerErr(null);
    setPosting(true);
    try {
      const post = await createPost(
        { id: user.uid, name: me?.name || user.displayName || 'Member', photo: me?.images?.[0] },
        { text, ...(media ?? {}) },
        activeGroup ? { id: activeGroup.id, name: activeGroup.name } : undefined
      );
      if (activeGroup) setGroupPosts((ps) => (ps ? [post, ...ps] : [post]));
      else setPosts((ps) => (ps ? [post, ...ps] : [post]));
      setLikes((s) => ({ ...s, [post.id]: { count: 0, likedByMe: false } }));
      setCommentCounts((s) => ({ ...s, [post.id]: 0 }));
      setGiftCounts((s) => ({ ...s, [post.id]: 0 }));
      setText('');
      setMedia(null);
    } catch (ex: any) {
      setComposerErr(ex?.code === 'permission-denied' ? d.app.rulesHint : C.errPost);
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const cur = likes[postId] ?? { count: 0, likedByMe: false };
    const next = { count: cur.count + (cur.likedByMe ? -1 : 1), likedByMe: !cur.likedByMe };
    setLikes((s) => ({ ...s, [postId]: next }));
    try {
      await setLiked(postId, user.uid, next.likedByMe);
    } catch {
      setLikes((s) => ({ ...s, [postId]: cur }));
    }
  };

  const giveGift = async (postId: string, type: GiftType) => {
    if (!user) return;
    setGiftPicker(null);
    setGiftCounts((s) => ({ ...s, [postId]: (s[postId] ?? 0) + 1 }));
    try {
      await sendGift(postId, { id: user.uid, name: me?.name || user.displayName || 'Member' }, type);
    } catch {
      setGiftCounts((s) => ({ ...s, [postId]: Math.max(0, (s[postId] ?? 1) - 1) }));
    }
  };

  const givePaidGift = async (postId: string, type: string, price: number) => {
    if (!user) return;
    if ((wallet?.coins ?? 0) < price) {
      setGiftPicker(null);
      flash(d.app.wallet.insufficient);
      setShowBuy(true);
      return;
    }
    setGiftPicker(null);
    setGiftCounts((s) => ({ ...s, [postId]: (s[postId] ?? 0) + 1 }));
    try {
      await sendPaidGiftFn(postId, type);
    } catch (ex: any) {
      setGiftCounts((s) => ({ ...s, [postId]: Math.max(0, (s[postId] ?? 1) - 1) }));
      const msg = String(ex?.message ?? '');
      if (msg.includes('insufficient-coins')) {
        flash(d.app.wallet.insufficient);
        setShowBuy(true);
      } else {
        flash(d.app.wallet.giftFail);
      }
    }
  };

  const buyPackage = async (packageId: string) => {
    setBuyBusy(packageId);
    try {
      await startCoinCheckout(packageId);
    } catch {
      flash(d.app.wallet.errBuy);
      setBuyBusy(null);
    }
  };

  const submitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutBusy) return;
    setPayoutErr(null);
    setPayoutBusy(true);
    try {
      await requestPayoutFn(gcash);
      setPayoutDone(true);
    } catch (ex: any) {
      const msg = String(ex?.message ?? '');
      if (msg.includes('below-minimum')) setPayoutErr(d.app.wallet.payoutBelowMin);
      else if (msg.includes('invalid-gcash')) setPayoutErr(d.app.wallet.payoutInvalidGcash);
      else setPayoutErr(d.app.wallet.payoutFail);
    } finally {
      setPayoutBusy(false);
    }
  };

  const toggleComments = async (postId: string) => {
    if (openComments[postId]) {
      setOpenComments((s) => {
        const n = { ...s };
        delete n[postId];
        return n;
      });
      return;
    }
    try {
      const cs = await listComments(postId);
      setOpenComments((s) => ({ ...s, [postId]: cs }));
    } catch {}
  };

  const sendComment = async (postId: string) => {
    const draft = (commentDrafts[postId] || '').trim();
    if (!user || !draft) return;
    setCommentDrafts((s) => ({ ...s, [postId]: '' }));
    try {
      const c = await addComment(postId, { id: user.uid, name: me?.name || user.displayName || 'Member' }, draft);
      setOpenComments((s) => ({ ...s, [postId]: [...(s[postId] ?? []), c] }));
      setCommentCounts((s) => ({ ...s, [postId]: (s[postId] ?? 0) + 1 }));
    } catch {
      setCommentDrafts((s) => ({ ...s, [postId]: draft }));
      window.alert(C.errComment);
    }
  };

  const removePost = async (postId: string, fromGroup: boolean) => {
    if (!window.confirm(C.deleteConfirm)) return;
    const setter = fromGroup ? setGroupPosts : setPosts;
    const prev = fromGroup ? groupPosts : posts;
    setter((ps) => (ps ? ps.filter((p) => p.id !== postId) : ps));
    try {
      await deletePost(postId);
    } catch {
      setter(prev ?? null);
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">{d.app.loading}</div>;
  if (needsEmailVerification(user)) return <VerifyEmail user={user} />;

  const avatar = (name: string, photo?: string, size = 40) => (
    <div
      className="rounded-full flex items-center justify-center font-display font-semibold text-ink flex-shrink-0 bg-cover bg-center"
      style={{ width: size, height: size, ...(photo ? { backgroundImage: `url(${photo})` } : { background: 'var(--blush)' }) }}
    >
      {!photo && (name?.[0] || '?')}
    </div>
  );

  const composer = (
    <div className="bg-white border border-line rounded-2xl p-5">
      <div className="flex gap-3">
        {avatar(me?.name || 'Y', me?.images?.[0])}
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={C.placeholder}
          className="flex-1 px-4 py-3 border border-line rounded-2xl bg-ivory text-sm outline-none focus:border-coral resize-none"
        />
      </div>
      {media && (
        <div className="mt-3 relative inline-block">
          {media.imageUrl
            ? <img src={media.imageUrl} alt="" className="max-h-[200px] rounded-xl block" />
            : <video src={media.videoUrl} controls className="max-h-[200px] rounded-xl block" />}
          <button onClick={() => setMedia(null)} aria-label={C.removeMedia} title={C.removeMedia} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
            <Icon.X size={12} />
          </button>
        </div>
      )}
      {composerErr && <div className="text-sm px-3 py-2 rounded-lg mt-3" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{composerErr}</div>}
      <div className="flex justify-between items-center mt-3">
        <label className="btn btn-ghost btn-sm cursor-pointer">
          <Icon.Camera size={14} /> {uploading ? C.uploadingMedia : C.media}
          <input type="file" accept="image/*,video/*" onChange={onFile} disabled={uploading || posting} className="hidden" />
        </label>
        <button onClick={publish} disabled={posting || uploading || (!text.trim() && !media)} className="btn btn-primary btn-sm disabled:opacity-50">
          {posting ? C.posting : C.post}
        </button>
      </div>
    </div>
  );

  const renderPost = (p: Post, fromGroup: boolean) => {
    const mine = p.authorId === user.uid;
    const like = likes[p.id];
    const cc = commentCounts[p.id];
    const gifts = giftCounts[p.id];
    const comments = openComments[p.id];
    return (
      <div key={p.id} className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 pt-4">
          <a href={`/app/profile?id=${p.authorId}`} aria-label={C.viewProfile}>{avatar(p.authorName, p.authorPhoto)}</a>
          <div className="flex-1 min-w-0">
            <a href={`/app/profile?id=${p.authorId}`} className="text-sm font-semibold hover:text-coral">{p.authorName}</a>
            <div className="text-[11px] text-muted">
              {formatTime(p.createdAt, time)}
              {!fromGroup && p.groupName ? ` · ${p.groupName}` : ''}
            </div>
          </div>
          {mine ? (
            <button onClick={() => removePost(p.id, fromGroup)} className="icon-btn" title={C.deletePost} aria-label={C.deletePost}>
              <Icon.X size={13} />
            </button>
          ) : (
            <button onClick={() => setReport({ targetId: p.authorId, targetName: p.authorName })} className="icon-btn" title={d.app.profile.reportAction} aria-label={d.app.profile.reportAction}>
              <Icon.Flag size={13} />
            </button>
          )}
        </div>
        {p.text && <div className="px-5 pt-3 text-[14px] leading-[1.55] whitespace-pre-wrap">{p.text}</div>}
        {p.imageUrl && <img src={p.imageUrl} alt="" loading="lazy" className="w-full max-h-[480px] object-cover mt-3" />}
        {p.videoUrl && <video src={p.videoUrl} controls playsInline className="w-full max-h-[480px] mt-3 bg-black" />}
        <div className="flex gap-2 px-5 py-3 border-t border-line mt-3 flex-wrap items-center">
          <button
            onClick={() => toggleLike(p.id)}
            className={`flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full ${like?.likedByMe ? 'text-white font-semibold' : 'text-ink-soft hover:bg-ivory'}`}
            style={like?.likedByMe ? { background: 'var(--coral)' } : {}}
          >
            <Icon.Heart size={13} filled={!!like?.likedByMe} /> {C.like}{like && like.count > 0 ? ` · ${like.count}` : ''}
          </button>
          <button onClick={() => toggleComments(p.id)} className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full text-ink-soft hover:bg-ivory">
            <Icon.Msg size={13} /> {C.comments}{cc ? ` · ${cc}` : ''}
          </button>
          <button
            onClick={() => setGiftPicker(giftPicker === p.id ? null : p.id)}
            aria-label={C.sendGift}
            title={C.sendGift}
            className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full text-ink-soft hover:bg-ivory"
          >
            🎁 {gifts ? ` ${gifts}` : ''}
          </button>
          {giftPicker === p.id && (
            paidMode ? (
              <div className="flex gap-1 flex-wrap">
                {PAID_GIFTS.map((g) => (
                  <button
                    key={g.type}
                    onClick={() => givePaidGift(p.id, g.type, g.coins)}
                    aria-label={`${C.sendGift}: ${g.type}`}
                    className="flex flex-col items-center px-1.5 py-0.5 rounded-lg hover:bg-ivory hover:scale-110 transition-transform"
                  >
                    <span className="text-[20px] leading-none">{g.emoji}</span>
                    <span className="text-[9px] text-muted">{g.coins}🪙</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-1">
                {GIFT_TYPES.map((g) => (
                  <button key={g} onClick={() => giveGift(p.id, g)} aria-label={`${C.sendGift}: ${g}`} className="text-[20px] px-1.5 py-0.5 rounded-lg hover:bg-ivory hover:scale-110 transition-transform">
                    {GIFT_EMOJI[g]}
                  </button>
                ))}
              </div>
            )
          )}
        </div>
        {comments && (
          <div className="px-5 pb-4 flex flex-col gap-2.5">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2.5 items-start">
                {avatar(c.authorName, undefined, 28)}
                <div className="bg-ivory rounded-2xl px-3.5 py-2 text-[13px] flex-1">
                  <a href={`/app/profile?id=${c.authorId}`} className="font-semibold hover:text-coral">{c.authorName}</a>
                  <div className="leading-snug">{c.text}</div>
                </div>
              </div>
            ))}
            <div className="flex gap-2 items-center mt-1">
              <input
                value={commentDrafts[p.id] || ''}
                onChange={(e) => setCommentDrafts((s) => ({ ...s, [p.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && sendComment(p.id)}
                placeholder={C.writeComment}
                className="flex-1 px-3.5 py-2 border border-line rounded-full bg-ivory text-[13px] outline-none focus:border-coral"
              />
              <button onClick={() => sendComment(p.id)} disabled={!(commentDrafts[p.id] || '').trim()} aria-label={C.sendComment} className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-40" style={{ background: 'var(--coral)' }}>
                <Icon.Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const feedShown = posts?.filter((p) => feedFilter === 'all' || followingIds.has(p.authorId) || p.authorId === user.uid);
  const myGroups = groups?.filter((g) => myGroupIds.has(g.id)) ?? [];
  const otherGroups = groups?.filter((g) => !myGroupIds.has(g.id)) ?? [];

  const groupCard = (g: Group) => (
    <div key={g.id} className="bg-white border border-line rounded-2xl p-5 flex items-center gap-4">
      <button onClick={() => openGroup(g)} className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-xl text-white flex-shrink-0" style={{ background: 'var(--coral)' }}>
        {g.name[0]?.toUpperCase() || '?'}
      </button>
      <div className="flex-1 min-w-0">
        <button onClick={() => openGroup(g)} className="font-display font-semibold text-[16px] hover:text-coral text-left">{g.name}</button>
        {g.description && <div className="text-[13px] text-ink-soft truncate">{g.description}</div>}
        <div className="text-[11px] text-muted mt-0.5">{C.members(memberCounts[g.id] ?? 0)}</div>
      </div>
      <button
        onClick={() => toggleMembership(g)}
        className={`btn btn-sm flex-shrink-0 ${myGroupIds.has(g.id) ? 'btn-ghost' : 'btn-primary'}`}
      >
        {myGroupIds.has(g.id) ? C.joined : C.join}
      </button>
    </div>
  );

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
      <Sidebar route="community" user={user} me={me} />
      <main>
        <div className="sticky top-0 z-10 px-10 py-6 border-b border-line backdrop-blur-xl max-md:px-5 max-md:py-4" style={{ background: 'rgba(255,245,247,0.88)' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display font-bold text-[30px] m-0 tracking-[-0.015em]">{C.title}</h1>
              <div className="text-[13px] text-muted mt-1">{C.sub}</div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {paidMode && (
                <>
                  <button
                    onClick={() => setShowBuy(true)}
                    title={d.app.wallet.buyCoins}
                    className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-line hover:border-coral"
                  >
                    🪙 {wallet?.coins ?? 0}
                  </button>
                  {(wallet?.earned ?? 0) > 0 && (
                    <button
                      onClick={() => { setPayoutDone(false); setPayoutErr(null); setShowPayout(true); }}
                      title={d.app.wallet.earnings}
                      className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-line hover:border-coral"
                      style={{ color: 'var(--ok)' }}
                    >
                      💰 {wallet?.earned ?? 0}
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => { closeGroup(); setView('feed'); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${view === 'feed' ? 'text-white' : 'bg-white text-ink-soft border border-line hover:bg-ivory'}`}
                style={view === 'feed' ? { background: 'var(--coral)' } : {}}
              >
                {C.feedTab}
              </button>
              <button
                onClick={() => setView('groups')}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${view === 'groups' ? 'text-white' : 'bg-white text-ink-soft border border-line hover:bg-ivory'}`}
                style={view === 'groups' ? { background: 'var(--coral)' } : {}}
              >
                {C.groupsTab}
              </button>
            </div>
          </div>
        </div>

        <div className="p-10 max-md:p-5 max-w-[640px] mx-auto flex flex-col gap-5">
          {toast && (
            <div className="px-5 py-3.5 rounded-2xl text-white font-semibold shadow-lg" style={{ background: 'linear-gradient(135deg, var(--forest), var(--coral))' }}>
              {toast}
            </div>
          )}
          {error ? (
            <div className="text-center py-16">
              <div className="font-display font-semibold text-2xl mb-2">{d.app.browse.loadFailTitle}</div>
              <div className="text-ink-soft mb-5">{error === 'rules' ? d.app.rulesHint : d.app.browse.loadFailBody}</div>
              <button onClick={() => window.location.reload()} className="btn btn-primary">{d.app.browse.retry}</button>
            </div>
          ) : view === 'feed' ? (
            <>
              {composer}
              <div className="flex gap-2">
                {(['all', 'following'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFeedFilter(f)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium ${feedFilter === f ? 'text-white' : 'bg-white text-ink-soft border border-line hover:bg-ivory'}`}
                    style={feedFilter === f ? { background: 'var(--coral)' } : {}}
                  >
                    {f === 'all' ? C.filterAll : C.filterFollowing}
                  </button>
                ))}
              </div>
              {posts === null ? (
                <div className="text-center py-16 text-muted">{d.app.loading}</div>
              ) : feedShown!.length === 0 ? (
                <div className="text-center py-16 text-ink-soft">{C.empty}</div>
              ) : (
                feedShown!.map((p) => renderPost(p, false))
              )}
            </>
          ) : activeGroup ? (
            <>
              <div className="bg-white border border-line rounded-2xl p-5">
                <button onClick={closeGroup} className="text-[12px] text-muted hover:text-coral mb-3 flex items-center gap-1">
                  <span className="rotate-180 inline-flex"><Icon.Arrow size={12} /></span> {C.backToGroups}
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-bold text-2xl text-white flex-shrink-0" style={{ background: 'var(--coral)' }}>
                    {activeGroup.name[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display font-bold text-[22px] m-0">{activeGroup.name}</h2>
                    {activeGroup.description && <div className="text-[13px] text-ink-soft">{activeGroup.description}</div>}
                    <div className="text-[11px] text-muted mt-0.5">{C.members(memberCounts[activeGroup.id] ?? 0)}</div>
                  </div>
                  <button
                    onClick={() => toggleMembership(activeGroup)}
                    className={`btn btn-sm flex-shrink-0 ${myGroupIds.has(activeGroup.id) ? 'btn-ghost' : 'btn-primary'}`}
                  >
                    {myGroupIds.has(activeGroup.id) ? C.leave : C.join}
                  </button>
                </div>
              </div>
              {myGroupIds.has(activeGroup.id) && composer}
              {groupPosts === null ? (
                <div className="text-center py-16 text-muted">{d.app.loading}</div>
              ) : groupPosts.length === 0 ? (
                <div className="text-center py-16 text-ink-soft">{C.groupEmptyFeed}</div>
              ) : (
                groupPosts.map((p) => renderPost(p, true))
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setGErr(null); setShowCreate(true); }} className="btn btn-primary justify-center">
                + {C.createGroup}
              </button>
              {groups === null ? (
                <div className="text-center py-16 text-muted">{d.app.loading}</div>
              ) : groups.length === 0 ? (
                <div className="text-center py-16 text-ink-soft">{C.emptyGroups}</div>
              ) : (
                <>
                  {myGroups.length > 0 && (
                    <>
                      <div className="text-[11px] tracking-[0.1em] uppercase text-muted font-semibold">{C.myGroups}</div>
                      {myGroups.map(groupCard)}
                    </>
                  )}
                  {otherGroups.length > 0 && (
                    <>
                      <div className="text-[11px] tracking-[0.1em] uppercase text-muted font-semibold mt-2">{C.discoverGroups}</div>
                      {otherGroups.map(groupCard)}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(31,20,25,0.7)' }} onClick={() => setShowCreate(false)}>
          <form onSubmit={submitGroup} className="bg-white rounded-[24px] p-8 max-w-[420px] w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-bold text-[22px] m-0 mb-4">{C.createGroup}</h2>
            <div className="field mb-3">
              <label>{C.groupName}</label>
              <input required maxLength={60} value={gName} onChange={(e) => setGName(e.target.value)} />
            </div>
            <div className="field mb-4">
              <label>{C.groupDesc}</label>
              <textarea rows={2} maxLength={300} value={gDesc} onChange={(e) => setGDesc(e.target.value)} />
            </div>
            {gErr && <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{gErr}</div>}
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost" disabled={gBusy}>{d.app.report.cancel}</button>
              <button type="submit" className="btn btn-primary flex-1 justify-center disabled:opacity-60" disabled={gBusy || !gName.trim()}>
                {gBusy ? C.creating : C.create}
              </button>
            </div>
          </form>
        </div>
      )}
      {showBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(31,20,25,0.7)' }} onClick={() => !buyBusy && setShowBuy(false)}>
          <div className="bg-white rounded-[24px] p-8 max-w-[420px] w-full shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={d.app.wallet.buyCoins}>
            <h2 className="font-display font-bold text-[22px] m-0 mb-1">{d.app.wallet.buyCoins}</h2>
            <div className="text-[13px] text-muted mb-5">🪙 {wallet?.coins ?? 0}</div>
            <div className="flex flex-col gap-2.5">
              {COIN_PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => buyPackage(pkg.id)}
                  disabled={!!buyBusy}
                  className="flex justify-between items-center px-4 py-3.5 rounded-xl border border-line hover:border-coral text-sm font-medium disabled:opacity-60"
                >
                  <span>🪙 {d.app.wallet.packageLabel(pkg.coins, pkg.usd.toFixed(2))}</span>
                  <span className="btn btn-primary btn-sm pointer-events-none">
                    {buyBusy === pkg.id ? d.app.wallet.processing : d.app.wallet.buy}
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowBuy(false)} disabled={!!buyBusy} className="btn btn-ghost w-full justify-center mt-4">{d.app.report.cancel}</button>
          </div>
        </div>
      )}
      {showPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(31,20,25,0.7)' }} onClick={() => !payoutBusy && setShowPayout(false)}>
          <div className="bg-white rounded-[24px] p-8 max-w-[420px] w-full shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={d.app.wallet.payoutTitle}>
            <h2 className="font-display font-bold text-[22px] m-0 mb-1">{d.app.wallet.payoutTitle}</h2>
            <div className="text-[13px] text-muted mb-4">
              {d.app.wallet.earnedCoins(wallet?.earned ?? 0)} · {d.app.wallet.payoutEstimate(((wallet?.earned ?? 0) * PAYOUT_USD_PER_COIN).toFixed(2))}
            </div>
            {payoutDone ? (
              <>
                <div className="text-sm px-4 py-3 rounded-xl mb-5" style={{ background: 'rgba(76,175,80,0.1)', color: 'var(--ok)' }}>
                  {d.app.wallet.payoutSent}
                </div>
                <button onClick={() => setShowPayout(false)} className="btn btn-primary w-full justify-center">{d.app.report.close}</button>
              </>
            ) : (
              <form onSubmit={submitPayout}>
                <div className="field mb-3">
                  <label>{d.app.wallet.gcashLabel}</label>
                  <input required inputMode="tel" placeholder="09XX XXX XXXX" value={gcash} onChange={(e) => setGcash(e.target.value)} />
                </div>
                <div className="text-xs text-muted mb-4">{d.app.wallet.payoutNote}</div>
                {payoutErr && <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{payoutErr}</div>}
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => setShowPayout(false)} className="btn btn-ghost" disabled={payoutBusy}>{d.app.report.cancel}</button>
                  <button
                    type="submit"
                    className="btn btn-primary flex-1 justify-center disabled:opacity-60"
                    disabled={payoutBusy || (wallet?.earned ?? 0) < MIN_PAYOUT_COINS}
                  >
                    {payoutBusy ? d.app.wallet.processing : d.app.wallet.requestPayout}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {report && <ReportDialog reporterId={user.uid} target={report} d={d} onClose={() => setReport(null)} />}
    </div>
  );
}
