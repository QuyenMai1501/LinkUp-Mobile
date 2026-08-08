import { Platform } from 'react-native';

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
    heading: 'Montserrat',
    body: 'Open Sans',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
    heading: 'Montserrat',
    body: 'Open Sans',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
    heading: 'var(--font-family-heading)',
    body: 'var(--font-family-body)',
  },
});

/**
 * Text styles using the mobile breakpoint values from DESIGN.md.
 * heading/body families need the actual font files loaded via expo-font (useFonts);
 * until then React Native falls back to system fonts.
 */
export const Typography = {
  h1: {
    fontFamily: Fonts?.heading,
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 31,
  },
  h2: {
    fontFamily: Fonts?.heading,
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 26,
  },
  body: {
    fontFamily: Fonts?.body,
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 24,
  },
  caption: {
    fontFamily: Fonts?.body,
    fontSize: 13,
    fontWeight: 300,
    lineHeight: 18,
  },
} as const;
