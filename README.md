# FilWest — Dating site (web)

Marketing site + web app for FilWest. Shares the same Firebase backend (`filwest`) as the mobile app, so profiles, matches, and messages sync across web and mobile.

## Stack
- **Astro 4** (static output, file-based routing) — marketing pages in English, Tagalog (`/tl/`), and Cebuano (`/ceb/`)
- **React 18** islands for interactive views (auth, discover, likes, community, profile, chat)
- **Tailwind CSS** + design tokens in `src/styles/globals.css`
- **Firebase** (Auth, Firestore, Storage) — same project as the mobile app

## Local dev
```bash
npm install
cp .env.example .env        # then fill in the Firebase web config values
npm run dev                 # http://localhost:4321
npm run build               # static build → dist/
npm run preview
```

## Going live — operations checklist
1. **Netlify**: connect this repo, branch `main` (build settings come from `netlify.toml`). Add the six `PUBLIC_FIREBASE_*` env vars (see `.env.example`) and trigger a deploy. `src/lib/firebase.ts` also carries the `filwest` web config as a fallback.
2. **Firebase Auth**: enable Email/Password (and Google) sign-in; add `filipinawest.com`, `www.filipinawest.com`, and the `*.netlify.app` domain to Authorized domains.
3. **Security rules** — two options:
   - *Automatic (recommended)*: add a `FIREBASE_SERVICE_ACCOUNT` secret to GitHub (repo → Settings → Secrets and variables → Actions) containing a service-account JSON key from Firebase Console → Project settings → Service accounts. The `deploy-rules.yml` workflow then publishes `firestore.rules`, `storage.rules`, and `firestore.indexes.json` automatically whenever they change (or on manual dispatch).
   - *Manual*: paste `firestore.rules` into Firestore → Rules and `storage.rules` into Storage → Rules in the Firebase console, and republish whenever they change in this repo.
4. **Support email**: `support@filipinawest.com` — set up forwarding at the domain registrar.
5. **Reports queue**: member reports land in the Firestore `reports` collection (`status: open`). Review them in the console until a moderation dashboard exists.
6. **Smoke test**: two opposite-gender accounts → verify email → complete profiles with photos → swipe deck → match modal → chat (text + photo + Seen receipt) → Likes page → Community post with media → like/comment → block/report flows.

## Paid gifts (Phase 2) — enabling coins & payouts
Paid gifting ships dark. Free emoji gifts work until you flip it on. To go live with real money:
1. Upgrade the Firebase project to the **Blaze** plan (Cloud Functions requirement).
2. Create a **Stripe** account; from the dashboard copy the secret key, then set the function secrets:
   `npx firebase-tools functions:secrets:set STRIPE_SECRET_KEY` and `…:set STRIPE_WEBHOOK_SECRET` (webhook secret comes from step 4).
3. Deploy: `npx firebase-tools deploy --only functions --project filwest`.
4. In Stripe → Developers → Webhooks, add an endpoint pointing at the deployed `stripeWebhook` function URL, listening to `checkout.session.completed`; copy its signing secret into the `STRIPE_WEBHOOK_SECRET` secret and redeploy.
5. Flip the switch: in Firestore create doc `config/app` with `paidGiftsEnabled: true`. The gift picker now shows coin prices, the wallet chip appears, and free gift writes are blocked by rules.
6. **Payouts are manual**: requests land in `payoutRequests` (`status: pending`) with the member's GCash number and the USD amount (rate and 1,000-coin minimum are constants in `functions/src/index.ts`). Send the GCash transfer, then set `status: paid`.
- Economics knobs: coin packages and gift prices in `functions/src/index.ts` (mirror them in `src/lib/wallet.ts`), payout rate `PAYOUT_USD_PER_COIN`.

## Structure
```
src/
  i18n/                 # en/tl/ceb dictionaries + helpers (marketing & app strings)
  layouts/
    Site.astro          # marketing pages (nav + footer, hreflang)
    Shell.astro         # logged-in app pages (no chrome)
    Legal.astro         # terms/privacy/community rules
    Article.astro       # /guides articles
  components/
    Nav, Footer, LogoMark      # Nav includes the EN/TL/CEB switcher
    marketing/          # Hero, FeatureBar, HowItWorks, Safety, Testimonials,
                        # Different, Pricing, AppShowcase
    pages/              # shared page bodies rendered per language
    auth/               # LoginForm, SignupWizard (Firebase-backed React islands)
    app/                # Sidebar, Browse (deck+grid), Likes, Community, Chat,
                        # ProfileView, VerifyEmail, MatchModal, ReportDialog
  lib/
    firebase.ts         # web SDK init (env vars with filwest fallback)
    auth.ts             # email + Google auth, verification, deletion
    profiles.ts         # profiles/{uid} CRUD + extended fields
    matching.ts         # swipes, matches, likers, Super Like quota
    chat.ts             # realtime messages, read receipts, image messages
    posts.ts            # community feed: posts, likes, comments
    blocking.ts         # block/unmatch
    reports.ts          # in-app reports → reports collection
    safety.ts           # scam-signal detection for chat warnings
    storage.ts          # profile/chat/post media uploads
    presence.ts         # online/lastActive
  pages/
    index|pricing|safety|login|signup .astro     # English
    [lang]/…                                     # /tl/… and /ceb/… variants
    guides/…                                     # dating guides (English)
    terms|privacy|community|404 .astro
    app/
      index.astro       # /app            → Discover (card deck / grid)
      likes.astro       # /app/likes      → Liked you + Matches
      community.astro   # /app/community  → feed (posts, likes, comments)
      messages.astro    # /app/messages   → Chat
      profile.astro     # /app/profile?id=→ Profile view / edit own
  styles/globals.css
```

## Firestore schema (shared with the mobile app)
- `profiles/{userId}` — `name`, `age`, `gender`, `city`, `country`, `bio`, `images[]`, `interests[]`, `lookingFor`, `occupation`, `education`, `height`, `religion`, `drinking`, `smoking`, `verified`, `online`, `lastActive`, `preferences{}`
- `swipes/{swipeId}` — `fromUserId`, `toUserId`, `direction` (`left` | `right` | `up`)
- `matches/{matchId}` — `user1Id`, `user2Id`, names/photos, `lastMessage`, `lastMessageTime`
- `matches/{matchId}/messages/{messageId}` — `senderId`, `text` | `imageUrl`, `type`, `timestamp`, `isRead`
- `blocks/{blockId}` — `blockerId`, `blockedId`
- `reports/{reportId}` — `reporterId`, `targetId`, `reason`, `details?`, `messageText?`, `status`
- `posts/{postId}` — `authorId`, `authorName`, `authorPhoto?`, `text?`, `imageUrl?`, `videoUrl?`, `groupId` (null for the main feed), `groupName?` (+ `likes/{uid}`, `comments/{id}`, `gifts/{id}` subcollections)
- `follows/{followerId_followedId}` — `followerId`, `followedId`
- `groups/{groupId}` — `name`, `description`, `ownerId`, `ownerName`
- `groupMembers/{groupId_userId}` — `groupId`, `userId`, `name`

Security rules and indexes live in this repo: `firestore.rules`, `storage.rules`, `firestore.indexes.json` (deployed by `.github/workflows/deploy-rules.yml`).

## Branding
- Colors and fonts live in `src/styles/globals.css` (CSS custom properties) and `tailwind.config.mjs`.
- The palette matches the mobile app: hot pink (`#FF1493`), coral pink (`#FF6B9D`), blush (`#FFDEE9`), gold accent.
