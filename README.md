# LinkUp Mobile

Expo (SDK 57) client for **LinkUp** — social app with feed, friends, 1-1 & group chat (E2EE), communities, calls and notifications, talking to the LinkUp Go backend.

- Dev instructions for AI/humans: [`AGENTS.md`](./AGENTS.md)
- Design tokens & layout patterns: [`DESIGN.md`](./DESIGN.md)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` (git-ignored — never commit) with:

   ```
   EXPO_PUBLIC_API_URL=http://localhost:8080   # LinkUp backend base URL (use LAN IP for a physical device)
   EXPO_PUBLIC_GIPHY_API_KEY=...
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
   ```

3. Start the dev server:

   ```bash
   npm start
   ```

   Press `w` for web, `a` for Android emulator, `i` for iOS simulator.

## Commands

| Action | Command | Notes |
|--------|---------|-------|
| Dev server | `npm start` | `npx expo start` |
| Android | `npm run android` | `expo run:android` (needs Android Studio) |
| iOS | `npm run ios` | `expo run:ios` (needs Xcode) |
| Web | `npm run web` | |
| Lint | `npm run lint` | `expo lint` — baseline has ~28 pre-existing problems, see AGENTS.md |
| Typecheck | `npx tsc --noEmit` | strict TS |

No test runner, no CI/CD, no commit hooks.

## Project structure

- `src/app/(drawer)/` — main screens (Drawer navigation): `index` (feed), `messages`, `chat/[chatId]`, `group-chat/[chatId]`, `friends`, `communities`, `saved`, `search`, `settings/`, `profile`, `post/[postId]`
- `src/app/(auth)/` — `login`, `register`, `forgot-password`, `verify-email`
- `src/api/` — REST clients (`client.ts` base + feature modules)
- `src/hooks/`, `src/contexts/`, `src/utils/` — hooks, providers, e2ee/notification helpers
- `src/components/` — UI (themed components under `components/ui/`, chat under `components/chat/`)
- `src/constants/` — design tokens (see DESIGN.md)
- `src/locales/` — i18n (`vi.json`, `en.json`)

## Notes

- **Nested git repo:** this folder has its own `.git` and remote (`QuyenMai1501/LinkUp-Mobile`); commits are separate from the monorepo root.
- Expo versioned docs: https://docs.expo.dev/versions/v57.0.0/
