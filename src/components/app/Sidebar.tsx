import React from 'react';
import { Icon, BrandMark } from '../icons';
import type { User } from 'firebase/auth';
import type { Profile } from '../../lib/profiles';
import { signOutUser } from '../../lib/auth';
import { useLang } from '../../i18n/react';
import { setClientLang, type Lang } from '../../i18n';

type RouteKey = 'browse' | 'likes' | 'community' | 'matches' | 'chat' | 'profile' | 'safety';

export default function Sidebar({ route, user, me }: { route: RouteKey; user: User | null; me: Profile | null }) {
  const { lang, d } = useLang();
  const L = d.app.sidebar;
  const initial = (me?.name || user?.displayName || user?.email || '?')[0].toUpperCase();
  const logout = async () => { await signOutUser(); window.location.href = '/'; };
  const changeLang = (next: Lang) => { setClientLang(next); window.location.reload(); };
  const items: { k: RouteKey; href: string; t: string; icon: React.ReactNode }[] = [
    { k: 'browse', href: '/app', t: L.discover, icon: <Icon.Home size={16} /> },
    { k: 'likes', href: '/app/likes', t: L.likes, icon: <Icon.Heart size={16} /> },
    { k: 'community', href: '/app/community', t: L.community, icon: <Icon.Users size={16} /> },
    { k: 'chat', href: '/app/messages', t: L.messages, icon: <Icon.Msg size={16} /> },
    { k: 'profile', href: '/app/profile', t: L.myProfile, icon: <Icon.Eye size={16} /> },
    { k: 'safety', href: '/safety', t: L.safety, icon: <Icon.Shield size={16} /> },
  ];
  return (
    <aside className="sticky top-0 z-20 h-screen border-r border-line p-[18px] flex flex-col gap-1 w-60 flex-shrink-0 bg-white max-md:h-auto max-md:w-full max-md:flex-row max-md:items-center max-md:gap-2 max-md:border-r-0 max-md:border-b max-md:px-4 max-md:py-2.5">
      <a href="/" className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-6 font-display text-xl font-bold max-md:p-0 max-md:text-lg">
        <BrandMark size={28} />
        <span className="max-md:hidden">FilWest</span>
      </a>
      <nav className="flex flex-col gap-0.5 max-md:flex-row max-md:gap-1 max-md:mx-auto">
        {items.map((i) => (
          <a
            key={i.k}
            href={i.href}
            aria-label={i.t}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm max-md:px-2.5 max-md:py-2 ${route === i.k ? 'text-white font-semibold' : 'text-ink-soft hover:bg-ivory'}`}
            style={route === i.k ? { background: 'var(--coral)' } : {}}
          >
            {i.icon}
            <span className="max-md:hidden">{i.t}</span>
          </a>
        ))}
      </nav>
      <div className="mt-auto pt-3 border-t border-line flex flex-col gap-2.5 p-3 max-md:mt-0 max-md:pt-0 max-md:p-0 max-md:border-t-0 max-md:ml-auto max-md:flex-row max-md:items-center">
        <select
          aria-label={L.language}
          value={lang}
          onChange={(e) => changeLang(e.target.value as Lang)}
          className="text-xs border border-line rounded-lg px-2 py-1.5 bg-white text-ink-soft outline-none cursor-pointer hover:border-coral max-md:px-1.5"
        >
          <option value="en">EN</option>
          <option value="tl">TL</option>
          <option value="ceb">CEB</option>
        </select>
        <div className="flex gap-2.5 items-center">
          <a href="/app/profile" aria-label={L.yourProfile} className="w-9 h-9 rounded-full flex items-center justify-center font-display font-semibold text-ink flex-shrink-0 max-md:w-8 max-md:h-8" style={{ background: 'var(--blush)' }}>
            {initial}
          </a>
          <div className="flex-1 min-w-0 max-md:hidden">
            <div className="text-[13px] font-semibold truncate">{me?.name || user?.displayName || L.you}</div>
            <button onClick={logout} className="text-[11px] text-muted hover:text-coral">
              {L.logout}
            </button>
          </div>
          <button onClick={logout} className="hidden max-md:block text-[11px] text-muted hover:text-coral">
            {L.logout}
          </button>
        </div>
      </div>
    </aside>
  );
}
