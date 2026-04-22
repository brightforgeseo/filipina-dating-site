import React from 'react';
import { Icon } from '../icons';
import type { User } from 'firebase/auth';
import type { Profile } from '../../lib/profiles';
import { signOutUser } from '../../lib/auth';

type RouteKey = 'browse' | 'matches' | 'chat' | 'profile' | 'safety';

export default function Sidebar({ route, user, me }: { route: RouteKey; user: User | null; me: Profile | null }) {
  const initial = (me?.name || user?.displayName || user?.email || '?')[0].toUpperCase();
  const items: { k: RouteKey; href: string; t: string; icon: React.ReactNode }[] = [
    { k: 'browse', href: '/app', t: 'Discover', icon: <Icon.Home size={16} /> },
    { k: 'chat', href: '/app/messages', t: 'Messages', icon: <Icon.Msg size={16} /> },
    { k: 'profile', href: user ? `/app/profile?id=${user.uid}` : '/login', t: 'My profile', icon: <Icon.Eye size={16} /> },
    { k: 'safety', href: '/safety', t: 'Safety', icon: <Icon.Shield size={16} /> },
  ];
  return (
    <aside className="sticky top-0 h-screen border-r border-line p-[18px] flex flex-col gap-1 w-60 flex-shrink-0 bg-white">
      <a href="/" className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-6 font-display text-xl font-bold">
        <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--coral)' }}>
          <Icon.Heart size={14} filled className="text-white" />
        </span>
        FilWest
      </a>
      <nav className="flex flex-col gap-0.5">
        {items.map((i) => (
          <a
            key={i.k}
            href={i.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${route === i.k ? 'text-white font-semibold' : 'text-ink-soft hover:bg-ivory'}`}
            style={route === i.k ? { background: 'var(--coral)' } : {}}
          >
            {i.icon}
            {i.t}
          </a>
        ))}
      </nav>
      <div className="mt-auto pt-3 border-t border-line flex gap-2.5 items-center p-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-display font-semibold text-ink flex-shrink-0" style={{ background: 'var(--blush)' }}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate">{me?.name || user?.displayName || 'You'}</div>
          <button onClick={async () => { await signOutUser(); window.location.href = '/'; }} className="text-[11px] text-muted hover:text-coral">
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
