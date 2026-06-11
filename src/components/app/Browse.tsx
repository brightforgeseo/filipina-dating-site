import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import VerifyEmail from './VerifyEmail';
import MatchModal, { type MatchInfo } from './MatchModal';
import { useAuth } from '../../lib/useAuth';
import { needsEmailVerification } from '../../lib/auth';
import { getProfile, listProfiles, saveProfile, type Profile } from '../../lib/profiles';
import { recordSwipe, getSwipedIds, getTodaySuperLikeCount, FREE_SUPER_LIKES_PER_DAY, type SwipeDirection } from '../../lib/matching';
import { getBlockedIds } from '../../lib/blocking';
import { markOnline } from '../../lib/presence';
import { useLang } from '../../i18n/react';
import { COUNTRY_OPTIONS } from '../../lib/constants';

type Prefs = { ageMin: number; ageMax: number; country: string };
const DEFAULT_PREFS: Prefs = { ageMin: 18, ageMax: 99, country: 'all' };

// Straight matching is built in: men are shown women and women are shown men.
// Members with another / unset gender see everyone.
function wantedGenderFor(me: Profile | null): 'female' | 'male' | null {
  if (me?.gender === 'male') return 'female';
  if (me?.gender === 'female') return 'male';
  return null;
}

function matchesPrefs(p: Profile, prefs: Prefs, wanted: 'female' | 'male' | null): boolean {
  if (wanted && p.gender !== wanted) return false;
  if (prefs.country !== 'all' && p.country !== prefs.country) return false;
  if (p.age && (p.age < prefs.ageMin || p.age > prefs.ageMax)) return false;
  return true;
}

const VIEW_KEY = 'filwest.discover-view';

export default function Browse() {
  const { d } = useLang();
  const B = d.app.browse;
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [profiles, setProfiles] = React.useState<Profile[] | null>(null);
  const [prefs, setPrefs] = React.useState<Prefs>(DEFAULT_PREFS);
  const [swiped, setSwiped] = React.useState<Record<string, SwipeDirection>>({});
  const [toast, setToast] = React.useState<string | null>(null);
  const [match, setMatch] = React.useState<MatchInfo | null>(null);
  const [error, setError] = React.useState<'rules' | 'network' | null>(null);
  const [view, setView] = React.useState<'deck' | 'grid'>('deck');
  const [superUsed, setSuperUsed] = React.useState(0);
  const [anim, setAnim] = React.useState<SwipeDirection | null>(null);

  React.useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === 'grid' || v === 'deck') setView(v);
    } catch {}
  }, []);

  const switchView = (v: 'deck' | 'grid') => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  };

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
        const [mine, list, alreadySwiped, blocked, superCount] = await Promise.all([
          getProfile(user.uid),
          listProfiles({ excludeId: user.uid, max: 50 }),
          getSwipedIds(user.uid),
          getBlockedIds(user.uid),
          getTodaySuperLikeCount(user.uid).catch(() => 0),
        ]);
        setMe(mine);
        setSuperUsed(superCount);
        const { ageMin, ageMax, country } = mine?.preferences ?? {};
        setPrefs({
          ageMin: ageMin ?? DEFAULT_PREFS.ageMin,
          ageMax: ageMax ?? DEFAULT_PREFS.ageMax,
          country: country ?? DEFAULT_PREFS.country,
        });
        setProfiles(list.filter((p) => !alreadySwiped.has(p.id) && !blocked.has(p.id)));
      } catch (ex: any) {
        setError(ex?.code === 'permission-denied' ? 'rules' : 'network');
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

  const swipe = async (p: Profile, direction: SwipeDirection) => {
    if (!user) return;
    setSwiped((s) => ({ ...s, [p.id]: direction }));
    if (direction === 'up') setSuperUsed((n) => n + 1);
    try {
      const res = await recordSwipe(user.uid, p.id, direction);
      if (res.matched) {
        setMatch({ name: res.matchedName || p.name, photo: p.images?.[0], myPhoto: me?.images?.[0] });
      }
    } catch {
      setSwiped((s) => {
        const n = { ...s };
        delete n[p.id];
        return n;
      });
      if (direction === 'up') setSuperUsed((n) => Math.max(0, n - 1));
    }
  };

  const visible = profiles?.filter((p) => !swiped[p.id] && matchesPrefs(p, prefs, wantedGenderFor(me)));
  const top = visible?.[0];
  const second = visible?.[1];

  const act = React.useCallback((direction: SwipeDirection) => {
    if (!top || anim) return;
    if (direction === 'up' && superUsed >= FREE_SUPER_LIKES_PER_DAY) {
      setToast(B.superLikeUsed);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setAnim(direction);
    const card = top;
    setTimeout(() => {
      setAnim(null);
      swipe(card, direction);
    }, 280);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, anim, superUsed]);

  React.useEffect(() => {
    if (view !== 'deck') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft') act('left');
      if (e.key === 'ArrowRight') act('right');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, act]);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">{d.app.loading}</div>;
  if (needsEmailVerification(user)) return <VerifyEmail user={user} />;

  const animStyle: React.CSSProperties = anim
    ? {
        transform: anim === 'left' ? 'translateX(-130%) rotate(-14deg)' : anim === 'right' ? 'translateX(130%) rotate(14deg)' : 'translateY(-130%)',
        opacity: 0,
        transition: 'transform 0.28s ease-in, opacity 0.28s ease-in',
      }
    : { transition: 'transform 0.2s ease-out' };

  const deckCard = (p: Profile, isTop: boolean) => (
    <div
      key={p.id}
      className="absolute inset-0 rounded-[24px] overflow-hidden shadow-xl bg-cover bg-center"
      style={{
        background: p.images?.[0] ? `url(${p.images[0]}) center/cover` : 'linear-gradient(135deg, var(--blush), var(--ivory-2))',
        ...(isTop ? animStyle : { transform: 'scale(0.95) translateY(14px)', filter: 'brightness(0.9)' }),
        zIndex: isTop ? 2 : 1,
      }}
    >
      {!p.images?.[0] && (
        <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-[140px] text-white/50">{p.name?.[0] || '?'}</div>
      )}
      <div className="absolute top-4 left-4 flex gap-1.5">
        {p.verified && <span className="chip" style={{ background: 'rgba(76,175,80,0.95)', color: '#fff', border: 'none', padding: '3px 9px', fontSize: 10 }}><Icon.Shield size={10} />{B.verified}</span>}
        {p.online && <span className="chip" style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--ok)', border: 'none', padding: '3px 9px', fontSize: 10 }}><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--ok)' }} />{B.online}</span>}
      </div>
      <a href={`/app/profile?id=${p.id}`} className="absolute inset-x-0 bottom-0 p-6 text-white block" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.65))' }}>
        <div className="font-display font-bold text-[34px] leading-none">{p.name}{p.age ? `, ${p.age}` : ''}</div>
        {(p.city || p.country) && (
          <div className="text-[13px] mt-1.5 flex items-center gap-1 opacity-90">
            <Icon.Pin size={11} /> {[p.city, p.country ? (d.options.countries[p.country] || p.country) : ''].filter(Boolean).join(', ')}
          </div>
        )}
        {p.bio && <div className="text-[13px] mt-2 leading-snug opacity-90" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.bio}</div>}
      </a>
    </div>
  );

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
      <Sidebar route="browse" user={user} me={me} />
      <main>
        <div className="sticky top-0 z-10 px-10 py-6 border-b border-line backdrop-blur-xl max-md:px-5 max-md:py-4" style={{ background: 'rgba(255,245,247,0.88)' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display font-bold text-[30px] m-0 tracking-[-0.015em]">{B.title}</h1>
              <div className="text-[13px] text-muted mt-1">{B.sub}</div>
            </div>
            <div className="flex gap-2 items-center flex-wrap text-[13px]">
              <div className="flex rounded-xl border border-line overflow-hidden mr-1" role="group">
                <button onClick={() => switchView('deck')} className={`px-3 py-2 text-[12px] font-medium ${view === 'deck' ? 'text-white' : 'bg-white text-ink-soft hover:bg-ivory'}`} style={view === 'deck' ? { background: 'var(--coral)' } : {}}>{B.viewCards}</button>
                <button onClick={() => switchView('grid')} className={`px-3 py-2 text-[12px] font-medium ${view === 'grid' ? 'text-white' : 'bg-white text-ink-soft hover:bg-ivory'}`} style={view === 'grid' ? { background: 'var(--coral)' } : {}}>{B.viewGrid}</button>
              </div>
              <label className="text-muted" htmlFor="pref-country">{B.country}</label>
              <select
                id="pref-country"
                value={prefs.country}
                onChange={(e) => updatePrefs({ ...prefs, country: e.target.value })}
                className="px-3 py-2 rounded-xl border border-line bg-white outline-none focus:border-coral"
              >
                <option value="all">{B.allCountries}</option>
                {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{d.options.countries[c] || c}</option>)}
              </select>
              <label className="text-muted" htmlFor="pref-age-min">{B.age}</label>
              <input
                id="pref-age-min"
                type="number" min={18} max={99}
                value={prefs.ageMin}
                onChange={(e) => updatePrefs({ ...prefs, ageMin: Math.max(18, Number(e.target.value) || 18) })}
                className="w-[64px] px-3 py-2 rounded-xl border border-line bg-white outline-none focus:border-coral"
              />
              <span className="text-muted">–</span>
              <input
                aria-label={B.maxAge}
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
            <Icon.Star size={18} filled /> {toast}
          </div>
        )}

        <div className="p-10 max-md:p-5">
          {error ? (
            <div className="text-center py-24 max-w-[560px] mx-auto">
              <div className="font-display font-semibold text-2xl mb-2">{B.loadFailTitle}</div>
              <div className="text-ink-soft mb-5">{error === 'rules' ? d.app.rulesHint : B.loadFailBody}</div>
              <button onClick={() => window.location.reload()} className="btn btn-primary">{B.retry}</button>
            </div>
          ) : visible === undefined || profiles === null ? (
            <div className="text-center py-24 text-muted">{B.loadingProfiles}</div>
          ) : visible.length === 0 ? (
            <div className="text-center py-24">
              <div className="font-display font-semibold text-2xl mb-2">{B.emptyTitle}</div>
              <div className="text-ink-soft">{B.emptyBody}</div>
            </div>
          ) : view === 'deck' ? (
            <div className="max-w-[400px] mx-auto">
              <div className="relative aspect-[3/4] select-none">
                {second && deckCard(second, false)}
                {top && deckCard(top, true)}
              </div>
              <div className="flex justify-center items-center gap-5 mt-6">
                <button
                  onClick={() => act('left')}
                  aria-label={B.pass}
                  title={B.pass}
                  className="w-[58px] h-[58px] rounded-full bg-white border border-line flex items-center justify-center text-ink-soft shadow hover:scale-105 transition-transform"
                >
                  <Icon.X size={22} />
                </button>
                <button
                  onClick={() => act('up')}
                  aria-label={B.superLike}
                  title={B.superLike}
                  className="w-[48px] h-[48px] rounded-full bg-white border border-line flex items-center justify-center shadow hover:scale-105 transition-transform disabled:opacity-40"
                  style={{ color: 'var(--gold)' }}
                  disabled={superUsed >= FREE_SUPER_LIKES_PER_DAY}
                >
                  <Icon.Star size={20} filled />
                </button>
                <button
                  onClick={() => act('right')}
                  aria-label={B.like}
                  title={B.like}
                  className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
                  style={{ background: 'var(--coral)' }}
                >
                  <Icon.Heart size={26} filled />
                </button>
              </div>
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
                      {p.verified && <span className="chip" style={{ background: 'rgba(76,175,80,0.95)', color: '#fff', border: 'none', padding: '3px 8px', fontSize: 10 }}><Icon.Shield size={10} />{B.verified}</span>}
                      {p.online && <span className="chip" style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--ok)', border: 'none', padding: '3px 8px', fontSize: 10 }}><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--ok)' }} />{B.online}</span>}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <div className="font-display font-bold text-[24px] leading-none">{p.name}{p.age ? `, ${p.age}` : ''}</div>
                      {p.city && <div className="text-[11px] mt-1 flex items-center gap-1 opacity-90"><Icon.Pin size={10} /> {p.city}</div>}
                    </div>
                  </a>
                  {p.bio && <div className="px-4 py-3 text-[13px] text-ink-soft line-clamp-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.bio}</div>}
                  <div className="flex gap-2 px-4 pb-4 mt-auto">
                    <button onClick={() => swipe(p, 'left')} className="flex-1 p-2.5 rounded-xl border border-line bg-white text-[13px] flex items-center justify-center gap-1.5 hover:bg-ivory">
                      <Icon.X size={14} />{B.pass}
                    </button>
                    <button onClick={() => swipe(p, 'right')} className="flex-1 p-2.5 rounded-xl text-[13px] flex items-center justify-center gap-1.5 text-white font-semibold" style={{ background: 'var(--coral)' }}>
                      <Icon.Heart size={14} filled />{B.like}
                    </button>
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
