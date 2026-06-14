import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import VerifyEmail from './VerifyEmail';
import MatchModal, { type MatchInfo } from './MatchModal';
import { useAuth } from '../../lib/useAuth';
import { needsEmailVerification } from '../../lib/auth';
import { getProfile, type Profile } from '../../lib/profiles';
import { getLikers, getSwipedIds, recordSwipe, type Liker } from '../../lib/matching';
import { getBlockedIds } from '../../lib/blocking';
import { getConversations, type Conversation } from '../../lib/chat';
import { markOnline } from '../../lib/presence';
import { useLang } from '../../i18n/react';

export default function Likes() {
  const { d } = useLang();
  const L = d.app.likes;
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [likers, setLikers] = React.useState<Liker[] | null>(null);
  const [matches, setMatches] = React.useState<Conversation[] | null>(null);
  const [tab, setTab] = React.useState<'liked' | 'matches'>('liked');
  const [match, setMatch] = React.useState<MatchInfo | null>(null);
  const [error, setError] = React.useState<'rules' | 'network' | null>(null);

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
        const [mine, allLikers, mySwipes, blocked, convos] = await Promise.all([
          getProfile(user.uid),
          getLikers(user.uid),
          getSwipedIds(user.uid),
          getBlockedIds(user.uid),
          getConversations(user.uid),
        ]);
        setMe(mine);
        // Anyone I already responded to (or blocked) doesn't belong in
        // "liked you" — if it was mutual they're in Matches already.
        setLikers(allLikers.filter((l) => !mySwipes.has(l.profile.id) && !blocked.has(l.profile.id)));
        setMatches(convos.filter((c) => !blocked.has(c.otherId)));
      } catch (ex: any) {
        setError(ex?.code === 'permission-denied' ? 'rules' : 'network');
      }
    })();
  }, [user, loading]);

  const respond = async (liker: Liker, direction: 'left' | 'right') => {
    if (!user) return;
    setLikers((ls) => (ls ? ls.filter((l) => l.profile.id !== liker.profile.id) : ls));
    try {
      const res = await recordSwipe(user.uid, liker.profile.id, direction);
      if (res.matched) {
        setMatch({ name: liker.profile.name, photo: liker.profile.images?.[0], myPhoto: me?.images?.[0] });
      }
    } catch {
      setLikers((ls) => (ls ? [liker, ...ls] : ls));
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">{d.app.loading}</div>;
  if (needsEmailVerification(user)) return <VerifyEmail user={user} />;

  const tabBtn = (k: 'liked' | 'matches', label: string, count: number | null) => (
    <button
      onClick={() => setTab(k)}
      className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === k ? 'text-white' : 'bg-white text-ink-soft border border-line hover:bg-ivory'}`}
      style={tab === k ? { background: 'var(--coral)' } : {}}
    >
      {label}{count !== null && count > 0 ? ` · ${count}` : ''}
    </button>
  );

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
      <Sidebar route="likes" user={user} me={me} />
      <main>
        <div className="sticky top-0 z-10 px-10 py-6 border-b border-line backdrop-blur-xl max-md:px-5 max-md:py-4" style={{ background: 'rgba(255,245,247,0.88)' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="font-display font-bold text-[30px] m-0 tracking-[-0.015em]">{L.title}</h1>
            <div className="flex gap-2">
              {tabBtn('liked', L.likedYou, likers?.length ?? null)}
              {tabBtn('matches', L.matches, matches?.length ?? null)}
            </div>
          </div>
        </div>

        <div className="p-10 max-md:p-5">
          {error ? (
            <div className="text-center py-24 max-w-[560px] mx-auto">
              <div className="font-display font-semibold text-2xl mb-2">{d.app.browse.loadFailTitle}</div>
              <div className="text-ink-soft mb-5">{error === 'rules' ? d.app.rulesHint : d.app.browse.loadFailBody}</div>
              <button onClick={() => window.location.reload()} className="btn btn-primary">{d.app.browse.retry}</button>
            </div>
          ) : (tab === 'liked' ? likers : matches) === null ? (
            <div className="text-center py-24 text-muted">{d.app.loading}</div>
          ) : tab === 'liked' ? (
            likers!.length === 0 ? (
              <div className="text-center py-24">
                <div className="font-display font-semibold text-2xl mb-2">{L.emptyLiked}</div>
                <a href="/app" className="btn btn-primary mt-4">{L.goDiscover}</a>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 max-md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
                {likers!.map((l) => (
                  <div key={l.profile.id} className="bg-white border border-line rounded-2xl overflow-hidden flex flex-col">
                    <a href={`/app/profile?id=${l.profile.id}`} className="aspect-[4/5] relative block overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--blush), var(--ivory-2))' }}>
                      {l.profile.images?.[0] ? (
                        <img src={l.profile.images[0]} alt={l.profile.name || ''} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-[80px] text-white/50">{l.profile.name?.[0] || '?'}</div>
                      )}
                      {l.superLike && (
                        <span className="absolute top-3 left-3 chip" style={{ background: 'var(--gold)', color: '#fff', border: 'none', padding: '3px 8px', fontSize: 10 }}>
                          <Icon.Star size={10} filled /> {L.superLikedYou}
                        </span>
                      )}
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <div className="font-display font-bold text-[22px] leading-none">{l.profile.name}{l.profile.age ? `, ${l.profile.age}` : ''}</div>
                        {l.profile.city && <div className="text-[11px] mt-1 flex items-center gap-1 opacity-90"><Icon.Pin size={10} /> {l.profile.city}</div>}
                      </div>
                    </a>
                    <div className="flex gap-2 px-4 py-4">
                      <button onClick={() => respond(l, 'left')} className="flex-1 p-2.5 rounded-xl border border-line bg-white text-[13px] flex items-center justify-center gap-1.5 hover:bg-ivory">
                        <Icon.X size={14} />{d.app.browse.pass}
                      </button>
                      <button onClick={() => respond(l, 'right')} className="flex-1 p-2.5 rounded-xl text-[13px] flex items-center justify-center gap-1.5 text-white font-semibold" style={{ background: 'var(--coral)' }}>
                        <Icon.Heart size={14} filled />{L.likeBack}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : matches!.length === 0 ? (
            <div className="text-center py-24">
              <div className="font-display font-semibold text-2xl mb-2">{L.emptyMatches}</div>
              <a href="/app" className="btn btn-primary mt-4">{L.goDiscover}</a>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 max-md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
              {matches!.map((c) => (
                <div key={c.matchId} className="bg-white border border-line rounded-2xl overflow-hidden flex flex-col">
                  <a href={`/app/profile?id=${c.otherId}`} className="aspect-[4/5] relative block overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--blush), var(--ivory-2))' }}>
                    {c.otherPhoto ? (
                      <img src={c.otherPhoto} alt={c.otherName || ''} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-[80px] text-white/50">{c.otherName?.[0] || '?'}</div>
                    )}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <div className="font-display font-bold text-[22px] leading-none">{c.otherName}</div>
                    </div>
                  </a>
                  <div className="px-4 py-4">
                    <a href="/app/messages" className="btn btn-primary btn-sm w-full justify-center">
                      <Icon.Msg size={14} /> {L.message}
                      {c.unreadCount > 0 && <span className="text-[10px] bg-white text-coral px-1.5 py-0.5 rounded-full font-bold">{c.unreadCount}</span>}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      {match && <MatchModal match={match} d={d} onClose={() => setMatch(null)} />}
    </div>
  );
}
