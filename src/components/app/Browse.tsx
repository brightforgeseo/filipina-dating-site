import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import VerifyEmail from './VerifyEmail';
import { useAuth } from '../../lib/useAuth';
import { needsEmailVerification } from '../../lib/auth';
import { getProfile, listProfiles, saveProfile, type Profile } from '../../lib/profiles';
import { recordSwipe, getSwipedIds } from '../../lib/matching';
import { getBlockedIds } from '../../lib/blocking';
import { markOnline } from '../../lib/presence';

type Prefs = { gender: 'female' | 'male' | 'all'; ageMin: number; ageMax: number };
const DEFAULT_PREFS: Prefs = { gender: 'all', ageMin: 18, ageMax: 99 };

function matchesPrefs(p: Profile, prefs: Prefs): boolean {
  if (prefs.gender !== 'all' && p.gender && p.gender !== prefs.gender) return false;
  if (p.age && (p.age < prefs.ageMin || p.age > prefs.ageMax)) return false;
  return true;
}

export default function Browse() {
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [profiles, setProfiles] = React.useState<Profile[] | null>(null);
  const [prefs, setPrefs] = React.useState<Prefs>(DEFAULT_PREFS);
  const [swiped, setSwiped] = React.useState<Record<string, 'left' | 'right' | 'up'>>({});
  const [toast, setToast] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);

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
        const [mine, list, alreadySwiped, blocked] = await Promise.all([
          getProfile(user.uid),
          listProfiles({ excludeId: user.uid, max: 50 }),
          getSwipedIds(user.uid),
          getBlockedIds(user.uid),
        ]);
        setMe(mine);
        setPrefs({ ...DEFAULT_PREFS, ...(mine?.preferences ?? {}) });
        setProfiles(list.filter((p) => !alreadySwiped.has(p.id) && !blocked.has(p.id)));
      } catch {
        setError(true);
      }
    })();
  }, [user, loading]);

  const prefsTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatePrefs = (next: Prefs) => {
    setPrefs(next);
    if (!user) return;
    // Filtering is instant; persisting is debounced — the age inputs fire on
    // every keystroke and each save is a Firestore round trip.
    if (prefsTimer.current) clearTimeout(prefsTimer.current);
    prefsTimer.current = setTimeout(() => {
      saveProfile(user.uid, { preferences: next }).catch(() => {});
    }, 800);
  };

  const swipe = async (p: Profile, direction: 'left' | 'right' | 'up') => {
    if (!user) return;
    setSwiped((s) => ({ ...s, [p.id]: direction }));
    try {
      const res = await recordSwipe(user.uid, p.id, direction);
      if (res.matched) {
        setToast(`It's a match with ${res.matchedName || p.name}! Start chatting →`);
        setTimeout(() => setToast(null), 4500);
      }
    } catch {
      setSwiped((s) => {
        const n = { ...s };
        delete n[p.id];
        return n;
      });
    }
  };

  if (loading || !user) return <FullScreenLoader />;
  if (needsEmailVerification(user)) return <VerifyEmail user={user} />;

  const visible = profiles?.filter((p) => !swiped[p.id] && matchesPrefs(p, prefs));

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
      <Sidebar route="browse" user={user} me={me} />
      <main>
        <div className="sticky top-0 z-10 px-10 py-6 border-b border-line backdrop-blur-xl max-md:px-5 max-md:py-4" style={{ background: 'rgba(255,245,247,0.88)' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display font-bold text-[30px] m-0 tracking-[-0.015em]">Discover</h1>
              <div className="text-[13px] text-muted mt-1">Real people, ready to meet.</div>
            </div>
            <div className="flex gap-2 items-center flex-wrap text-[13px]">
              <label className="text-muted" htmlFor="pref-gender">Show</label>
              <select
                id="pref-gender"
                value={prefs.gender}
                onChange={(e) => updatePrefs({ ...prefs, gender: e.target.value as Prefs['gender'] })}
                className="px-3 py-2 rounded-xl border border-line bg-white outline-none focus:border-coral"
              >
                <option value="all">Everyone</option>
                <option value="female">Women</option>
                <option value="male">Men</option>
              </select>
              <label className="text-muted" htmlFor="pref-age-min">Age</label>
              <input
                id="pref-age-min"
                type="number" min={18} max={99}
                value={prefs.ageMin}
                onChange={(e) => updatePrefs({ ...prefs, ageMin: Math.max(18, Number(e.target.value) || 18) })}
                className="w-[64px] px-3 py-2 rounded-xl border border-line bg-white outline-none focus:border-coral"
              />
              <span className="text-muted">–</span>
              <input
                aria-label="Maximum age"
                type="number" min={18} max={99}
                value={prefs.ageMax}
                onChange={(e) => updatePrefs({ ...prefs, ageMax: Math.min(99, Number(e.target.value) || 99) })}
                className="w-[64px] px-3 py-2 rounded-xl border border-line bg-white outline-none focus:border-coral"
              />
            </div>
          </div>
        </div>

        {toast && (
          <div className="mx-10 mt-6 px-5 py-4 rounded-2xl text-white font-semibold flex items-center gap-3 shadow-lg max-md:mx-5" style={{ background: 'linear-gradient(135deg, var(--forest), var(--coral))' }}>
            <Icon.Heart size={18} filled /> {toast}
            <a href="/app/messages" className="ml-auto underline underline-offset-2 text-sm">Open messages</a>
          </div>
        )}

        <div className="p-10 max-md:p-5">
          {error ? (
            <div className="text-center py-24">
              <div className="font-display font-semibold text-2xl mb-2">Couldn't load profiles.</div>
              <div className="text-ink-soft mb-5">Check your connection and try again.</div>
              <button onClick={() => window.location.reload()} className="btn btn-primary">Retry</button>
            </div>
          ) : visible === undefined || profiles === null ? (
            <div className="text-center py-24 text-muted">Loading profiles…</div>
          ) : visible.length === 0 ? (
            <div className="text-center py-24">
              <div className="font-display font-semibold text-2xl mb-2">No profiles match right now.</div>
              <div className="text-ink-soft">Try widening your filters, or check back soon.</div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 max-md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
              {visible.map((p) => (
                <div key={p.id} className="bg-white border border-line rounded-2xl overflow-hidden flex flex-col transition hover:-translate-y-1 hover:shadow">
                  <a href={`/app/profile?id=${p.id}`} className="aspect-[4/5] relative block" style={{ background: p.images?.[0] ? `url(${p.images[0]}) center/cover` : 'linear-gradient(135deg, var(--blush), var(--ivory-2))' }}>
                    {!p.images?.[0] && (
                      <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-[80px] text-white/50">{p.name?.[0] || '?'}</div>
                    )}
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {p.verified && <span className="chip" style={{ background: 'rgba(76,175,80,0.95)', color: '#fff', border: 'none', padding: '3px 8px', fontSize: 10 }}><Icon.Shield size={10} />Verified</span>}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <div className="font-display font-bold text-[24px] leading-none">{p.name}{p.age ? `, ${p.age}` : ''}</div>
                      {p.city && <div className="text-[11px] mt-1 flex items-center gap-1 opacity-90"><Icon.Pin size={10} /> {p.city}</div>}
                    </div>
                  </a>
                  {p.bio && <div className="px-4 py-3 text-[13px] text-ink-soft line-clamp-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.bio}</div>}
                  <div className="flex gap-2 px-4 pb-4 mt-auto">
                    <button onClick={() => swipe(p, 'left')} className="flex-1 p-2.5 rounded-xl border border-line bg-white text-[13px] flex items-center justify-center gap-1.5 hover:bg-ivory">
                      <Icon.X size={14} />Pass
                    </button>
                    <button onClick={() => swipe(p, 'right')} className="flex-1 p-2.5 rounded-xl text-[13px] flex items-center justify-center gap-1.5 text-white font-semibold" style={{ background: 'var(--coral)' }}>
                      <Icon.Heart size={14} filled />Like
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FullScreenLoader() {
  return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">Loading…</div>;
}
