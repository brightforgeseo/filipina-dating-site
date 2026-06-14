# FilWest matches profile rendering, 2026-06-14

## Goal
Fix Ben's report: profile rendering issues on Matches.

## Evidence and current findings
- Repo: `C:/Users/user/Documents/filipinawest-work/filipina-dating-site`, branch `main`.
- Existing worknote shows previous morph bug fixed by preserving Firestore doc IDs in `src/lib/profiles.ts`.
- Inspected matches UI in `src/components/app/Likes.tsx` and conversation/profile image source in `src/lib/chat.ts`.
- Matches tab renders from `getConversations()`, which reads `user1Name/user2Name/user1Photo/user2Photo` from the match document snapshot.
- That means the matches card can render stale or empty profile data after a user edits/uploads a profile photo, even when the real profile doc is correct.
- Profile photos across Matches and Chat are injected as CSS `background: url(...)`, which is weaker for user-uploaded Firebase URLs than real `<img>` elements and gives no natural error/fallback behaviour.

## Planned fix
- Enrich conversations from live profile docs, using match snapshot as fallback only.
- Render match/chat photos with real `<img>` tags and fallback initials instead of CSS `background: url(...)`.
- Patch matching liker profile ID sanitisation if still vulnerable to body `id` overwrites.

## Verification to run
- `npm run check`
- `npm run build`
- Inspect built bundle/source for live profile enrichment and `<img>` rendering.
- Push if clean, then check GitHub/Netlify if available.
