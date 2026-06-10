import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import { useAuth } from '../../lib/useAuth';
import { getProfile, type Profile } from '../../lib/profiles';
import { recordSwipe } from '../../lib/matching';

export default function ProfileView() {
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [target, setTarget] = React.useState<Profile | null | undefined>(undefined);
  const [toast, setToast] = React.useState<string | null>(null);

  const targetId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('id')
    : null;

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    (async () => {
      setMe(await getProfile(user.uid));
      if (targetId) setTarget(await getProfile(targetId));
      else setTarget(null);
    })();
  }, [user, loading, targetId]);

  const like = async () => {
    if (!user || !target) return;
    try {
      const res = await recordSwipe(user.uid, target.id, 'right');
      if (res.matched) {
        setToast(`It's a match with ${res.matchedName || target.name}!`);
        setTimeout(() => (window.location.href = '/app/messages'), 1400);
      } else {
        setToast('Liked! We’ll let them know.');
        setTimeout(() => setToast(null), 2200);
      }
    } catch {
      setToast('Could not send your like. Please try again.');
      setTimeout(() => setToast(null), 2200);
    }
  };

  if (loading || !user || target === undefined) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">Loading…</div>;

  if (target === null) {
    return (
      <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
        <Sidebar route="profile" user={user} me={me} />
        <main className="p-10">
          <h1 className="font-display font-bold text-3xl mb-2">Profile not found</h1>
          <p className="text-ink-soft">That profile doesn’t exist or was removed.</p>
          <a href="/app" className="btn btn-primary mt-5">Back to Discover</a>
        </main>
      </div>
    );
  }

  const p = target;
  const isMyProfile = user.uid === p.id;

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
      <Sidebar route="profile" user={user} me={me} />
      <main>
        <div className="sticky top-0 z-10 flex items-center justify-between px-10 py-6 border-b border-line backdrop-blur-xl" style={{ background: 'rgba(255,245,247,0.88)' }}>
          <h1 className="font-display font-bold text-[28px] m-0 tracking-[-0.015em]">{isMyProfile ? 'Your profile' : `${p.name}'s profile`}</h1>
          {!isMyProfile && <div className="flex gap-2.5">
            <button className="icon-btn"><Icon.Flag size={14} /></button>
          </div>}
        </div>
        <div className="p-10 max-w-[1000px] mx-auto">
          {toast && <div className="mb-6 px-5 py-3 rounded-2xl text-white font-semibold flex items-center gap-2" style={{ background: 'var(--coral)' }}><Icon.Heart size={16} filled />{toast}</div>}
          <div className="grid md:grid-cols-[1.1fr_1fr] gap-8">
            <div className="rounded-[20px] overflow-hidden h-[480px] relative" style={{ background: p.images?.[0] ? `url(${p.images[0]}) center/cover` : 'linear-gradient(135deg, var(--blush), var(--ivory-2))' }}>
              {!p.images?.[0] && (
                <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-[180px] text-white/40">{p.name[0]}</div>
              )}
            </div>
            <div>
              <div className="flex gap-2 mb-3">
                {p.verified && <span className="chip chip-verified"><Icon.Shield size={11} />Verified</span>}
                {p.online && <span className="chip" style={{ background: 'rgba(76,175,80,0.1)', color: 'var(--ok)', borderColor: 'rgba(76,175,80,0.25)' }}>Online now</span>}
              </div>
              <h2 className="font-display font-bold text-5xl tracking-[-0.02em] m-0 mb-2">
                {p.name}{p.age ? <span className="text-muted font-normal">, {p.age}</span> : null}
              </h2>
              {(p.city || p.country) && (
                <div className="text-[15px] text-ink-soft flex gap-1.5 items-center mb-5">
                  <Icon.Pin size={13} /> {[p.city, p.country].filter(Boolean).join(', ')}
                </div>
              )}
              {p.bio && <p className="text-[15px] leading-[1.6] text-ink-soft mb-6">{p.bio}</p>}
              {(p.interests?.length || p.lookingFor) && (
                <div className="py-5 border-y border-line flex flex-col gap-4">
                  {p.lookingFor && (
                    <div>
                      <div className="text-[10px] tracking-[0.1em] uppercase text-muted mb-1 font-semibold">Looking for</div>
                      <div className="text-[15px]">{p.lookingFor}</div>
                    </div>
                  )}
                  {p.interests?.length ? (
                    <div>
                      <div className="text-[10px] tracking-[0.1em] uppercase text-muted mb-2 font-semibold">Interests</div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.interests.map((t) => <span key={t} className="chip">{t}</span>)}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
              {!isMyProfile && (
                <div className="flex gap-2.5 mt-6">
                  <a href="/app" className="btn btn-ghost"><Icon.X size={14} /></a>
                  <button onClick={like} className="btn btn-primary flex-1 justify-center">
                    <Icon.Heart size={14} filled /> Like
                  </button>
                </div>
              )}
              {isMyProfile && (
                <div className="mt-6 text-sm text-muted">This is how others see you.</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
