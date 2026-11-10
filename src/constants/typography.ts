import { Platform, type TextStyle } from 'react-native';

/**
 * Be Vietnam Pro — cùng bộ file với web (`LinkUp_Web/app/fonts`), load qua
 * `useFonts` trong `app/_layout.tsx`. Mỗi weight là một family riêng vì
 * Android không tự chọn weight từ một family custom.
 */
export const FontFamilies = {
  regular: 'BeVietnamPro-Regular',
  medium: 'BeVietnamPro-Medium',
  semibold: 'BeVietnamPro-SemiBold',
  bold: 'BeVietnamPro-Bold',
} as const;

export function fontFamilyForWeight(
  weight?: TextStyle['fontWeight'] | number,
): string {
  if (weight == null) return FontFamilies.regular;
  if (typeof weight === 'number') {
    if (weight >= 700) return FontFamilies.bold;
    if (weight >= 600) return FontFamilies.semibold;
    if (weight >= 500) return FontFamilies.medium;
    return FontFamilies.regular;
  }
  if (weight === 'bold') return FontFamilies.bold;
  if (weight === 'normal') return FontFamilies.regular;
  const numeric = Number(weight);
  if (Number.isFinite(numeric)) {
    return fontFamilyForWeight(numeric);
  }
  return FontFamilies.regular;
}

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
    heading: FontFamilies.semibold,
    body: FontFamilies.regular,
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
    heading: FontFamilies.semibold,
    body: FontFamilies.regular,
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
    heading: FontFamilies.semibold,
    body: FontFamilies.regular,
  },
});

/**
 * Text styles using the mobile breakpoint values from DESIGN.md.
 * Font files are loaded via expo-font (useFonts) in the root layout.
 */
export const Typography = {
  h1: {
    fontFamily: FontFamilies.bold,
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 31,
  },
  h2: {
    fontFamily: FontFamilies.semibold,
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 26,
  },
  body: {
    fontFamily: FontFamilies.regular,
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 24,
  },
  caption: {
    fontFamily: FontFamilies.regular,
    fontSize: 13,
    fontWeight: 300,
    lineHeight: 18,
  },
} as const;
