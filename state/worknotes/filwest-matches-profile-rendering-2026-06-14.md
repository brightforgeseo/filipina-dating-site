# FilWest matches profile rendering, 2026-06-14

## Goal
Fix Ben's report: profile rendering issues on Matches.

## Evidence and current findings
- Repo: `C:/Users/user/Documents/filipinawest-work/filipina-dating-site`, branch `main`.
- Existing worknote shows previous morph bug fixed by preserving Firestore doc IDs in `src/lib/profiles.ts`.
- Inspected matches UI in `src/components/app/Likes.tsx` and conversation/profile image source in `src/lib/chat.ts`.
- Matches tab renders from `getConversations()`, which read `user1Name/user2Name/user1Photo/user2Photo` from the match document snapshot.
- That means the matches card could render stale or empty profile data after a user edits/uploads a profile photo, even when the real profile doc is correct.
- Profile photos across Matches and Chat were injected as CSS `background: url(...)`, which is weaker for user-uploaded Firebase URLs than real `<img>` elements and gives no natural error/fallback behaviour.
- `getLikers()` still had the same body `id` overwrite pattern that was fixed in `profiles.ts`, so the Liked You tab could still be vulnerable to duplicate/wrong profile IDs.

## Fix applied
Commit `c62b0d1` pushed to `origin/main`:
- `src/lib/chat.ts`: `getConversations()` now reads the other member's live profile doc and uses live `name`/first profile image, with match snapshot values only as fallback.
- `src/components/app/Likes.tsx`: Liked You and Matches cards now render profile photos with real `<img>` elements inside fixed aspect-ratio cards, not CSS background URLs.
- `src/components/app/Chat.tsx`: conversation list and thread header avatars now use real `<img>` elements and initials fallback.
- `src/lib/matching.ts`: `getLikers()` strips persisted body `id` and keeps the Firestore document ID authoritative.

## Verification run
- `npm run check`: passed.
- `npm run build`: passed, 30 pages built. Existing Vite chunk-size warning only.
- Built bundles inspected:
  - `dist/_astro/Likes.D9cv_nav.js` contains `img` and `object-cover`, with no `url(${` image background pattern.
  - `dist/_astro/Chat.p9ath3P_.js` contains `img` and `object-cover`, with no `url(${` image background pattern.
  - `dist/_astro/chat.BdjUn-Vx.js` imports the profile module, confirming live profile enrichment made it into the build.
- GitHub CI run `27490744799`: passed.
- Live unauthenticated `/app/likes/` redirects/renders login as expected. Authenticated Matches visual QA was not possible here without live test account access.
- Netlify CLI is installed but not logged in, so Netlify deploy status could not be checked via CLI.

## Honest status
- Source fix: committed and pushed.
- Local build/CI: passed.
- Live authenticated Matches page: needs Ben to refresh/retest, or provide test account/session access for exact visual confirmation.
