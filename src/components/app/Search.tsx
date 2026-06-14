import React from 'react';
import { useAuth } from '../../lib/useAuth';
import { getBlockedIds } from '../../lib/blocking';
import {
  searchEnabled,
  searchPosts,
  searchProfiles,
  type PostHit,
  type ProfileHit,
} from '../../lib/search';

export default function Search() {
  const { user, loading } = useAuth();
  const [q, setQ] = React.useState('');
  const [profiles, setProfiles] = React.useState<ProfileHit[]>([]);
  const [posts, setPosts] = React.useState<PostHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const hiddenRef = React.useRef<Set<string>>(new Set());
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    getBlockedIds(user.uid).then((s) => (hiddenRef.current = s)).catch(() => {});
  }, [user, loading]);

  React.useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setProfiles([]);
      setPosts([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const [ps, po] = await Promise.all([searchProfiles(q), searchPosts(q)]);
      const hidden = hiddenRef.current;
      setProfiles(ps.filter((p) => p.objectID !== user?.uid && !hidden.has(p.objectID)));
      setPosts(po.filter((p) => !hidden.has(p.authorId)));
      setSearching(false);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display font-bold text-3xl tracking-[-0.02em]">Search</h1>
          <a href="/app" className="text-sm text-muted hover:text-coral">← App</a>
        </div>

        {!searchEnabled ? (
          <div className="card p-6 text-center">
            <div className="text-3xl mb-2">🔍</div>
            <div className="font-semibold">Search isn’t set up yet</div>
            <div className="text-sm text-ink-soft mt-1">Add the Algolia keys (see SEARCH_SETUP.md) to enable people & post search.</div>
          </div>
        ) : (
          <>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people, posts, #hashtags…"
              className="w-full px-4 py-3 rounded-full border border-line bg-white outline-none focus:border-coral"
            />

            {q.trim() && (
              <div className="mt-6">
                {searching && profiles.length === 0 && posts.length === 0 ? (
                  <div className="text-center text-muted py-10">Searching…</div>
                ) : profiles.length === 0 && posts.length === 0 ? (
                  <div className="text-center text-muted py-10">No results for “{q}”.</div>
                ) : (
                  <>
                    {profiles.length > 0 && (
                      <>
                        <h2 className="text-xs uppercase tracking-wide text-muted font-semibold mb-2">People</h2>
                        <div className="grid grid-cols-2 gap-3 mb-6 max-md:grid-cols-1">
                          {profiles.map((p) => (
                            <a key={p.objectID} href={`/app/profile?id=${p.objectID}`} className="card p-3 flex items-center gap-3 hover:border-coral">
                              <div className="w-12 h-12 rounded-full bg-cover bg-center flex-shrink-0" style={p.image ? { backgroundImage: `url(${p.image})` } : { background: 'var(--blush)' }} />
                              <div className="min-w-0">
                                <div className="font-semibold truncate">
                                  {p.name}{p.age ? `, ${p.age}` : ''} {p.verified ? '✅' : ''}
                                </div>
                                <div className="text-xs text-ink-soft truncate">{[p.city, p.country].filter(Boolean).join(', ')}</div>
                              </div>
                            </a>
                          ))}
                        </div>
                      </>
                    )}

                    {posts.length > 0 && (
                      <>
                        <h2 className="text-xs uppercase tracking-wide text-muted font-semibold mb-2">Posts</h2>
                        <div className="flex flex-col gap-2">
                          {posts.map((p) => (
                            <a key={p.objectID} href="/app/community" className="card p-3 hover:border-coral">
                              <div className="text-sm font-semibold text-coral">{p.authorName}</div>
                              <div className="text-sm text-ink-soft line-clamp-2">{p.text}</div>
                            </a>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
