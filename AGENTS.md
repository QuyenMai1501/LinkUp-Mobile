# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code. Expo SDK 57 / React Native 0.86 may differ from your training data — check the versioned docs first, heed deprecations, and trust `node_modules` types over memory.

# Commands

Run everything from this directory (`sources/LinkUp_Mobile/`).

| Action | Command | Notes |
|--------|---------|-------|
| Dev server | `npm start` | `npx expo start` — press `w` for web, `a` for Android |
| Android emulator | `npm run android` | |
| iOS simulator | `npm run ios` | |
| Web | `npm run web` | |
| Lint | `npm run lint` | runs `expo lint` (`eslint-config-expo` flat config, `eslint.config.js`) |
| Typecheck | `npx tsc --noEmit` | strict TS via `expo/tsconfig.base` |

No test runner, no CI/CD, no commit hooks.

**Environment:** `.env` (git-ignored, never commit) — required keys: `EXPO_PUBLIC_API_URL` (backend base URL, e.g. `http://localhost:8080`), `EXPO_PUBLIC_GIPHY_API_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

**Lint baseline:** `npm run lint` reports ~28 pre-existing problems (15 errors — mostly `profile.tsx`, `comment-sheet.tsx`). Don't chase them; only keep files you touch clean.

# Architecture

- **Stack:** Expo SDK 57, React Native 0.86.2, expo-router, React 19.2.3, TypeScript strict
- **Routing:** expo-router file-based routing in `src/app/`. Entrypoint is `main: "expo-router/entry"` in `package.json`. Route groups:
  - `src/app/_layout.tsx` — root **Stack** (`(drawer)` + `(auth)`, `headerShown: false`): providers `ThemeModeProvider` + `AuthProvider` + `CallProvider` + `LanguageProvider` + `NotificationProvider`, animated splash, `CallOverlay`, and an `AuthRedirect` guard (unauthenticated → `/(auth)/login`).
  - `src/app/(drawer)/` — main app: `_layout.tsx` renders a **Drawer** with screens `index` (feed home), `messages`, `friends`, `communities`, `saved`, `search`, `settings` (sub-pages under `settings/`), `profile`, `profile/[userId]`, `chat/[chatId]`, `group-chat/[chatId]`, `post/[postId]`.
  - `src/app/(auth)/` — full-screen auth (no drawer): `_layout.tsx` (Stack, `headerShown:false`), `login.tsx`, `register.tsx`, `forgot-password.tsx`, `verify-email.tsx`. Register and forgot-password show an inline "check your email" state after the API call.
- **Path aliases:** `@/*` → `src/*`, `@/assets/*` → `assets/*`
- **`app.json` experiments:** `typedRoutes` + `reactCompiler` enabled. Scheme `linkupmobile`, Android package `com.linkup.mobile`, EAS project owner `quyenmai`.
- **Platform variants via file suffix:** `*.web.tsx` (e.g. `app-tabs.web.tsx`, `animated-icon.web.tsx`, `hooks/use-color-scheme.web.ts`). A `.web.tsx` file shadows the base file on web only.
- **App scope:** full client against the LinkUp Go backend — feed/posts, 1-1 & group chat (E2EE), friends, communities, calls, notifications, settings. The Expo starter template screens are long gone.

# Design system

- **Source of truth:** design tokens live in `src/constants/colors.ts` (light/dark palette + `Shadows`), `src/constants/spacing.ts` (`Spacing`, `Radius`, layout constants), `src/constants/typography.ts` (`Fonts`, `Typography`).
- **`src/constants/theme.ts` is a legacy compatibility shim** for the template components. Do NOT add new tokens to it — import from `colors.ts`/`spacing.ts`/`typography.ts` directly.
- **Consume theme via:** `useTheme()` hook (`src/hooks/use-theme.ts` → `Colors[scheme]`) and the `ThemedText` / `ThemedView` components (`type`/`themeColor` props, `ThemeColor` type).
- Full reference (palettes, type scale, do's/don'ts): **`DESIGN.md`**.
- Colors are mode-dependent; render both light and dark correctly via the theme objects.

# Quirks

- **Nested independent git repo:** this directory has its own `.git` + remote (`QuyenMai1501/LinkUp-Mobile`) — the parent monorepo cannot track its files. Commits here are separate from the parent repo.
- `CLAUDE.md` delegates to this file via `@AGENTS.md`.
