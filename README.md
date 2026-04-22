# FilWest — Dating site (web)

Marketing site + web app for FilWest. Shares the same Firebase backend (`filwest`) as the mobile app, so profiles, matches, and messages sync across web and mobile.

## Stack
- **Astro 4** (static output, file-based routing)
- **React 18** islands for interactive views (auth, discover, profile, chat)
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

## Netlify deploy
1. Connect this repo on Netlify (build command and publish dir are in `netlify.toml`).
2. Under **Site settings → Environment variables**, add the six `PUBLIC_FIREBASE_*` keys (see `.env.example`). These mirror the values the mobile app uses.
3. Deploy.

## Structure
```
src/
  layouts/
    Site.astro          # marketing pages (nav + footer)
    Shell.astro         # logged-in app pages (no chrome)
  components/
    Nav, Footer, LogoMark
    marketing/          # Hero, FeatureBar, HowItWorks, Safety,
                        # Testimonials, Pricing, AppShowcase
    auth/               # LoginForm, SignupWizard (Firebase-backed React islands)
    app/                # Sidebar, Browse, ProfileView, Chat (Firebase-backed)
  lib/
    firebase.ts         # web SDK init
    auth.ts             # email + Google auth
    profiles.ts         # read/write profiles/{uid}
    matching.ts         # swipes + match creation
    chat.ts             # messages subscriptions + send
    useAuth.ts          # React hook
  pages/
    index.astro         # /
    login.astro         # /login
    signup.astro        # /signup
    safety.astro        # /safety
    pricing.astro       # /pricing
    app/
      index.astro       # /app              → Discover
      messages.astro    # /app/messages     → Chat
      profile.astro     # /app/profile?id=  → Profile detail
  styles/globals.css
```

## Firestore schema (shared with the mobile app)
- `profiles/{userId}` — `name`, `age`, `gender`, `city`, `country`, `bio`, `images[]`, `interests[]`, `verified`, `online`
- `swipes/{swipeId}` — `fromUserId`, `toUserId`, `direction` (`left` | `right` | `up`)
- `matches/{matchId}` — `user1Id`, `user2Id`, `user1Name`, `user2Name`, `user1Photo`, `user2Photo`, `lastMessage`, `lastMessageTime`
- `matches/{matchId}/messages/{messageId}` — `senderId`, `text` | `imageUrl` | `videoUrl`, `type`, `timestamp`, `isRead`

Security rules live with the mobile app in `firebase/firestore.rules`.

## Branding
- Colors and fonts live in `src/styles/globals.css` (CSS custom properties) and `tailwind.config.mjs`.
- The palette matches the mobile app: hot pink (`#FF1493`), coral pink (`#FF6B9D`), blush (`#FFDEE9`), gold accent.
