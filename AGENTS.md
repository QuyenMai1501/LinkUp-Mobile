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

# Architecture

- **Stack:** Expo SDK 57, React Native 0.86.2, expo-router, React 19.2.3, TypeScript strict
- **Routing:** expo-router file-based routing in `src/app/`. Entrypoint is `main: "expo-router/entry"` in `package.json`. Route groups:
  - `src/app/_layout.tsx` — root **Stack**: `ThemeModeProvider` + `AuthProvider` + animated splash + navigation `ThemeProvider`; screens `(tabs)` and `(auth)`.
  - `src/app/(tabs)/` — main app: `_layout.tsx` renders `AppTabs` (native tabs); `index.tsx` = Home (LinkUp intro), `explore.tsx` = Explore.
  - `src/app/(auth)/` — full-screen auth (no tab bar): `_layout.tsx` (Stack, `headerShown:false`), `login.tsx`, `register.tsx`, `forgot-password.tsx`. Register and forgot-password show an inline "check your email" state after the API call.
- **Path aliases:** `@/*` → `src/*`, `@/assets/*` → `assets/*`
- **`app.json` experiments:** `typedRoutes` + `reactCompiler` enabled. Scheme `linkupmobile`, Android package `com.linkup.mobile`, EAS project owner `quyenmai`.
- **Platform variants via file suffix:** `*.web.tsx` (e.g. `app-tabs.web.tsx`, `animated-icon.web.tsx`, `hooks/use-color-scheme.web.ts`). A `.web.tsx` file shadows the base file on web only.
- **App is still the Expo starter template** — Home/Explore are placeholder screens. Auth flows (login/register/forgot-password) are built against the backend `/api/auth/*` endpoints.

# Design system

- **Source of truth:** design tokens live in `src/constants/colors.ts` (light/dark palette + `Shadows`), `src/constants/spacing.ts` (`Spacing`, `Radius`, layout constants), `src/constants/typography.ts` (`Fonts`, `Typography`).
- **`src/constants/theme.ts` is a legacy compatibility shim** for the template components. Do NOT add new tokens to it — import from `colors.ts`/`spacing.ts`/`typography.ts` directly.
- **Consume theme via:** `useTheme()` hook (`src/hooks/use-theme.ts` → `Colors[scheme]`) and the `ThemedText` / `ThemedView` components (`type`/`themeColor` props, `ThemeColor` type).
- Full reference (palettes, type scale, do's/don'ts): **`DESIGN.md`**.
- Colors are mode-dependent; render both light and dark correctly via the theme objects.

# Quirks

- Pre-existing lint error in `src/hooks/use-color-scheme.web.ts:11` (`setState` inside `useEffect`) — fix it if you touch the file.
- **Nested independent git repo:** this directory has its own `.git` + remote (`QuyenMai1501/LinkUp-Mobile`) — the parent monorepo cannot track its files. Commits here are separate from the parent repo.
- `CLAUDE.md` delegates to this file via `@AGENTS.md`.
