import { algoliasearch } from 'algoliasearch';

// Public, search-only credentials (safe to expose client-side). Indexing is
// done server-side with the admin key. When unset, search is disabled and the
// UI shows a "not configured" state — the rest of the app is unaffected.
const APP_ID = (import.meta.env.PUBLIC_ALGOLIA_APP_ID as string | undefined) || '';
const SEARCH_KEY = (import.meta.env.PUBLIC_ALGOLIA_SEARCH_KEY as string | undefined) || '';

export const searchEnabled = !!APP_ID && !!SEARCH_KEY;

let _client: ReturnType<typeof algoliasearch> | null = null;
function client() {
  if (!_client) _client = algoliasearch(APP_ID, SEARCH_KEY);
  return _client;
}

export type ProfileHit = {
  objectID: string;
  name: string;
  age?: number | null;
  city?: string;
  country?: string;
  image?: string;
  verified?: boolean;
};

export type PostHit = {
  objectID: string;
  text: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
};

export async function searchProfiles(q: string): Promise<ProfileHit[]> {
  if (!searchEnabled || !q.trim()) return [];
  try {
    const res = await client().searchSingleIndex<ProfileHit>({
      indexName: 'profiles',
      searchParams: { query: q, hitsPerPage: 20 },
    });
    return res.hits as ProfileHit[];
  } catch {
    return [];
  }
}

export async function searchPosts(q: string): Promise<PostHit[]> {
  if (!searchEnabled || !q.trim()) return [];
  try {
    const res = await client().searchSingleIndex<PostHit>({
      indexName: 'posts',
      searchParams: { query: q, hitsPerPage: 20 },
    });
    return res.hits as PostHit[];
  } catch {
    return [];
  }
}
