import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { watchAuth } from './auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Register for web push once a member is signed in. Lazy-imported so the
  // messaging SDK only loads in the browser for authenticated sessions.
  useEffect(() => {
    if (!user) return;
    import('./push')
      .then(({ registerWebPush }) => registerWebPush(user))
      .catch(() => {});
  }, [user]);

  return { user, loading };
}
