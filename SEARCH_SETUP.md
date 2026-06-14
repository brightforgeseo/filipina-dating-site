# Search setup (Algolia) — do this when you're ready

Search is fully built on both apps; it just needs an Algolia account wired up.
Until then, the search page/screen shows a "not set up yet" state and nothing
else is affected. The indexing runs server-side; the clients use a public
search-only key.

## 1. Create the Algolia app + indexes
1. Sign up at https://www.algolia.com (the free "Build" tier is plenty to start).
2. Create an **Application**.
3. Create two indexes (Search → Index → Create): **`profiles`** and **`posts`**.
4. (Recommended) Configure relevance per index → *Configure → Searchable attributes*:
   - `profiles`: `name`, `city`, `country`, `bio`, `interests`
   - `posts`: `text`, `authorName`
   Add `interests` as a searchable attribute so #hashtag/interest matches work.

## 2. Get the three keys
Algolia dashboard → *Settings → API Keys*:
- **Application ID** (e.g. `ABC123XYZ`)
- **Admin API Key** — server-side indexing only. Keep secret.
- **Search-Only API Key** — safe to expose in the apps.

## 3. Configure the indexing function (web repo)
The sync triggers (`syncProfileIndex`, `syncPostIndex`) live in
`filipina-dating-site/functions`.
```bash
cd filipina-dating-site/functions
# app id is a plain env var:
echo "ALGOLIA_APP_ID=YOUR_APP_ID" >> .env
# admin key is a secret:
firebase functions:secrets:set ALGOLIA_ADMIN_KEY      # paste the Admin API Key
npm install && npm run build
cd .. && firebase deploy --only functions               # deploys the sync triggers
```
From now on, every profile/post create/update/delete keeps Algolia in sync.

## 4. Backfill existing data (one-off)
The triggers only fire on *future* writes, so index what's already there once.
Save this as `functions/backfill-search.js` and run `node backfill-search.js`
(from `functions/`, after `npm install`), with a service-account key:
```js
const admin = require('firebase-admin');
const { algoliasearch } = require('algoliasearch');
admin.initializeApp({ credential: admin.credential.applicationDefault() }); // or cert(serviceAccount)
const db = admin.firestore();
const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_ADMIN_KEY);

(async () => {
  const profiles = await db.collection('profiles').get();
  await client.saveObjects({ indexName: 'profiles', objects: profiles.docs.map((d) => {
    const p = d.data();
    return { objectID: d.id, name: p.name ?? '', age: p.age ?? null, city: p.city ?? p.location ?? '',
      country: p.country ?? '', gender: p.gender ?? '', bio: p.bio ?? '',
      interests: Array.isArray(p.interests) ? p.interests : [],
      image: Array.isArray(p.images) ? (p.images[0] ?? '') : '', verified: p.verified === true };
  }) });

  const posts = await db.collection('posts').get();
  const pub = posts.docs.filter((d) => !d.data().groupId && d.data().text);
  await client.saveObjects({ indexName: 'posts', objects: pub.map((d) => {
    const p = d.data();
    return { objectID: d.id, text: p.text, authorId: p.authorId ?? '', authorName: p.authorName ?? '',
      authorPhoto: p.authorPhoto ?? '', createdAt: p.createdAt?.toMillis?.() ?? 0 };
  }) });
  console.log('Backfill done:', profiles.size, 'profiles,', pub.length, 'posts');
})();
```
Run it with `ALGOLIA_APP_ID=... ALGOLIA_ADMIN_KEY=... node backfill-search.js`.

## 5. Point the apps at Algolia (search-only key)
**Website (Netlify env vars), then redeploy:**
```
PUBLIC_ALGOLIA_APP_ID=YOUR_APP_ID
PUBLIC_ALGOLIA_SEARCH_KEY=YOUR_SEARCH_ONLY_KEY
```
**Mobile app (EAS env/secrets), then a new build:**
```
EXPO_PUBLIC_ALGOLIA_APP_ID=YOUR_APP_ID
EXPO_PUBLIC_ALGOLIA_SEARCH_KEY=YOUR_SEARCH_ONLY_KEY
```
Use the **same** app id and **search-only** key for both. Done — the `/search`
page (web) and the search screen (app, magnifier in the home header) go live.

## Notes
- Search results are filtered client-side against blocked/banned users.
- Only public (non-group) posts with text are indexed.
- Cost scales with records + searches; the free tier covers early usage.
