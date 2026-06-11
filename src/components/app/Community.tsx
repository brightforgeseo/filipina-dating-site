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
  listPosts, createPost, deletePost, uploadPostMedia,
  getLikeInfo, setLiked, getCommentCount, listComments, addComment,
  type Post, type PostComment,
} from '../../lib/posts';
import { useLang } from '../../i18n/react';

type LikeState = { count: number; likedByMe: boolean };

export default function Community() {
  const { d } = useLang();
  const C = d.app.community;
  const time = d.app.time;
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [posts, setPosts] = React.useState<Post[] | null>(null);
  const [likes, setLikes] = React.useState<Record<string, LikeState>>({});
  const [commentCounts, setCommentCounts] = React.useState<Record<string, number>>({});
  const [openComments, setOpenComments] = React.useState<Record<string, PostComment[]>>({});
  const [commentDrafts, setCommentDrafts] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<'rules' | 'network' | null>(null);
  const [report, setReport] = React.useState<ReportTarget | null>(null);

  // Composer
  const [text, setText] = React.useState('');
  const [media, setMedia] = React.useState<{ imageUrl?: string; videoUrl?: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [posting, setPosting] = React.useState(false);
  const [composerErr, setComposerErr] = React.useState<string | null>(null);

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
        const [mine, all, blocked] = await Promise.all([
          getProfile(user.uid),
          listPosts(30),
          getBlockedIds(user.uid),
        ]);
        setMe(mine);
        const visible = all.filter((p) => !blocked.has(p.authorId));
        setPosts(visible);
        // Like/comment counts load in the background; cards render immediately.
        visible.forEach(async (p) => {
          try {
            const [info, cc] = await Promise.all([getLikeInfo(p.id, user.uid), getCommentCount(p.id)]);
            setLikes((s) => ({ ...s, [p.id]: info }));
            setCommentCounts((s) => ({ ...s, [p.id]: cc }));
          } catch {}
        });
      } catch (ex: any) {
        setError(ex?.code === 'permission-denied' ? 'rules' : 'network');
      }
    })();
  }, [user, loading]);

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
        { text, ...(media ?? {}) }
      );
      setPosts((ps) => (ps ? [post, ...ps] : [post]));
      setLikes((s) => ({ ...s, [post.id]: { count: 0, likedByMe: false } }));
      setCommentCounts((s) => ({ ...s, [post.id]: 0 }));
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

  const removePost = async (postId: string) => {
    if (!window.confirm(C.deleteConfirm)) return;
    const prev = posts;
    setPosts((ps) => (ps ? ps.filter((p) => p.id !== postId) : ps));
    try {
      await deletePost(postId);
    } catch {
      setPosts(prev ?? null);
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

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
      <Sidebar route="community" user={user} me={me} />
      <main>
        <div className="sticky top-0 z-10 px-10 py-6 border-b border-line backdrop-blur-xl max-md:px-5 max-md:py-4" style={{ background: 'rgba(255,245,247,0.88)' }}>
          <h1 className="font-display font-bold text-[30px] m-0 tracking-[-0.015em]">{C.title}</h1>
          <div className="text-[13px] text-muted mt-1">{C.sub}</div>
        </div>

        <div className="p-10 max-md:p-5 max-w-[640px] mx-auto flex flex-col gap-5">
          {/* Composer */}
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

          {/* Feed */}
          {error ? (
            <div className="text-center py-16">
              <div className="font-display font-semibold text-2xl mb-2">{d.app.browse.loadFailTitle}</div>
              <div className="text-ink-soft mb-5">{error === 'rules' ? d.app.rulesHint : d.app.browse.loadFailBody}</div>
              <button onClick={() => window.location.reload()} className="btn btn-primary">{d.app.browse.retry}</button>
            </div>
          ) : posts === null ? (
            <div className="text-center py-16 text-muted">{d.app.loading}</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-ink-soft">{C.empty}</div>
          ) : (
            posts.map((p) => {
              const mine = p.authorId === user.uid;
              const like = likes[p.id];
              const cc = commentCounts[p.id];
              const comments = openComments[p.id];
              return (
                <div key={p.id} className="bg-white border border-line rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-5 pt-4">
                    <a href={`/app/profile?id=${p.authorId}`} aria-label={C.viewProfile}>{avatar(p.authorName, p.authorPhoto)}</a>
                    <div className="flex-1 min-w-0">
                      <a href={`/app/profile?id=${p.authorId}`} className="text-sm font-semibold hover:text-coral">{p.authorName}</a>
                      <div className="text-[11px] text-muted">{formatTime(p.createdAt, time)}</div>
                    </div>
                    {mine ? (
                      <button onClick={() => removePost(p.id)} className="icon-btn" title={C.deletePost} aria-label={C.deletePost}>
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
                  <div className="flex gap-2 px-5 py-3 border-t border-line mt-3">
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
            })
          )}
        </div>
      </main>
      {report && <ReportDialog reporterId={user.uid} target={report} d={d} onClose={() => setReport(null)} />}
    </div>
  );
}
