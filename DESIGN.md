# Design System — LinkUp (Mobile)

> **Source of truth:** all tokens are defined in `src/constants/` — `colors.ts` (light/dark palette + shadows), `spacing.ts` (spacing/radius/layout), `typography.ts` (fonts + type scale). This file is the human-readable reference. When values change, edit the constants first, then update this doc.

Tokens follow the web design system (`sources/LinkUp_Web/DESIGN.md` + `globals.css`), with React Native-specific notes.

---

## Color Palette

Tokens are grouped per mode. Use them through `useTheme()` or `ThemedText`/`ThemedView` — never hardcode hex in components.

### Brand Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary` | `#12A5A1` (Turquoise) | `#3FBFBA` | Logo, links, active states, primary icons; CTA outline/pills |
| `primaryHover` | `#0C918D` | `#2BB0AC` | Primary hover |
| `primaryActive` | `#0A7D79` | `#1FA3A0` | Primary active/click |
| `primaryLight` | `rgba(18,165,161,0.12)` | `rgba(63,191,186,0.22)` | Hover/focus highlights, active rows |
| `secondary` | `#0A1F44` (Navy) | `#1A1A1A` | Header, footer, dark backgrounds; solid CTA buttons |
| `secondaryHover` | `#0D2A5A` | `#222222` | Secondary button hover |
| `secondaryActive` | `#0F3570` | `#2A2A2A` | Secondary button active |
| `accent` | `#FF6F00` (Orange) | `#FF6F00` | Highlights, notifications, badges |
| `accentHover` | `#E66300` | `#E66300` | Accent button hover |
| `accentActive` | `#CC5800` | `#CC5800` | Accent button active |

### Neutral Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `bg` | `#FFFFFF` | `#111111` | Main background |
| `bgPrimary` | `#FFFFFF` | `#111111` | Primary background (alias of `bg`) |
| `bgSecondary` | `#F5F5F5` | `#1A1A1A` | Secondary background, cards |
| `bgHover` | `#ECECEC` | `#242424` | Hover backgrounds |
| `text` | `#000000` | `#E5E7EB` | Primary text |
| `textSecondary` | `#666666` | `#9CA3AF` | Secondary/muted text |
| `card` | `#FFFFFF` | `#1E1E1E` | Card surfaces |
| `border` | `#E0E0E0` | `#333333` | Borders, outlines |
| `divider` | `#EEEEEE` | `#2A2A2A` | Section dividers |

### Semantic Colors

Base colors are identical in both modes; only the `*Light` variants change.

| Token | Value | Light `*Light` | Dark `*Light` | Usage |
|-------|-------|----------------|----------------|-------|
| `success` | `#388E3C` | `#E8F5E9` | `#064E3B` | Success states, active badges |
| `warning` | `#FBC02D` | `#FFF8E1` | `#78350F` | Warning states, suspended badges |
| `danger` | `#D32F2F` | `#FFEBEE` | `#7F1D1D` | Error/danger states, banned badges |
| `info` | `#1976D2` | `#E3F2FD` | `#1E3A5F` | Informational, reviewed badges |

---

## Typography

- **Font families:** `Montserrat` for headings, `Open Sans` for body (defined as `Fonts.heading` / `Fonts.body` in `typography.ts`).
- **Font loading:** on native, the families only apply once the actual font files are loaded via `expo-font` (`useFonts`). Until then RN falls back to system fonts. Do not invent asset paths — add real `.ttf`/`.otf` assets when available.

### Text Styles (`Typography` in `typography.ts`)

Mobile breakpoint values (from the web DESIGN.md responsive table: H1 24px, H2 20px on mobile).

| Token | Weight | Size | Line Height | Usage |
|-------|--------|------|-------------|-------|
| `h1` | Bold (700) | 24px | 31 | Page titles |
| `h2` | SemiBold (600) | 20px | 26 | Section headings |
| `body` | Regular (400) | 16px | 24 | Body text |
| `caption` | Light (300) | 13px | 18 | Captions, helper text |

Prefer `ThemedText` with a semantic `type` (`title`, `subtitle`, `small`, `smallBold`, `link`, `linkPrimary`, `code`, `default`) over raw `Text`.

---

## Spacing

| Token | Value |
|-------|-------|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 4 | Small elements, chips |
| `md` | 8 | Buttons, inputs |
| `lg` | 20 | Cards, panels |
| `pill` | 9999 | Pill shapes, badges |
| `circle` | `'50%'` | Avatars, circular icons |

---

## Shadows

Defined per mode in `Shadows` (`colors.ts`). These are **raw CSS values for reference** — React Native does not render them directly. To apply shadows use platform props: iOS `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`; Android `elevation`.

| Token | Light | Dark |
|-------|-------|------|
| `sm` | `0 1px 3px rgba(0,0,0,0.08)` | `0 1px 3px rgba(0,0,0,0.45)` |
| `md` | `0 4px 12px rgba(0,0,0,0.1)` | `0 4px 12px rgba(0,0,0,0.55)` |
| `lg` | `0 12px 28px rgba(0,0,0,0.15)` | `0 12px 28px rgba(0,0,0,0.65)` |

---

## Theme API

- **`useTheme()`** (`src/hooks/use-theme.ts`) returns the active palette object (`Colors[scheme]`). Reads the color scheme via `useColorScheme()`; falls back to light when scheme is `unspecified`.
- **`ThemedText`** — props: `type` (`default` | `title` | `subtitle` | `small` | `smallBold` | `link` | `linkPrimary` | `code`) and `themeColor` (`ThemeColor` — any palette key).
- **`ThemedView`** — props: `type` (`ThemeColor`) and `lightColor`/`darkColor` overrides.
- **`ThemeColor`** — `keyof Colors.light & keyof Colors.dark` (all palette keys).
- **Legacy shim** `src/constants/theme.ts` keeps old template names (`background`, `backgroundElement`, `Spacing.half/one/two/...`) so existing template components compile. **Do not extend it** — new code uses the new token names.

---

## Dark Mode

- Detect via `useColorScheme()` (re-exported from `src/hooks/use-color-scheme.ts`; `.web.ts` variant re-hydrates on the client for static rendering).
- Toggle is system-driven; there is no in-app manual theme switch yet.
- Always render with the palette object from `useTheme()` so both modes work automatically.

---

## Do's and Don'ts

### Do

- Use tokens from `src/constants/` — never hardcode colors, sizes, or radii in components
- Use `ThemedText`/`ThemedView` and `useTheme()` for anything theme-dependent
- Use `Spacing.*` for all spacing, `Radius.*` for all border radius
- Use `Typography.*` (or `ThemedText` types) for text styles
- Support both light and dark modes via the palette objects
- Use `fontWeight` as a number (template convention, e.g. `fontWeight: 500`)

### Don't

- Don't hardcode hex codes or `px`-like literals in components
- Don't add tokens to the `theme.ts` legacy shim
- Don't use raw CSS values for shadows — convert to RN platform props
- Don't assume Montserrat/Open Sans are loaded — they need `expo-font` assets
- Don't invent font asset paths
