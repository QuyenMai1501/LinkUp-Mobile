/**
 * LinkUp design tokens — ported from LinkUp_Web DESIGN.md / globals.css.
 * Colors are split into light and dark modes.
 */

export const Colors = {
  light: {
    // Brand
    primary: '#12A5A1',
    primaryHover: '#0C918D',
    primaryActive: '#0A7D79',
    primaryLight: 'rgba(18, 165, 161, 0.12)',
    secondary: '#0A1F44',
    secondaryHover: '#0D2A5A',
    secondaryActive: '#0F3570',
    accent: '#FF6F00',
    accentHover: '#E66300',
    accentActive: '#CC5800',

    // Neutral
    bg: '#FFFFFF',
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F5F5F5',
    bgHover: '#ECECEC',
    text: '#000000',
    textSecondary: '#666666',
    card: '#FFFFFF',
    border: '#E0E0E0',
    divider: '#EEEEEE',

    // Semantic
    success: '#388E3C',
    successLight: '#E8F5E9',
    warning: '#FBC02D',
    warningLight: '#FFF8E1',
    danger: '#D32F2F',
    dangerLight: '#FFEBEE',
    info: '#1976D2',
    infoLight: '#E3F2FD',
  },
  dark: {
    // Brand
    primary: '#3FBFBA',
    primaryHover: '#2BB0AC',
    primaryActive: '#1FA3A0',
    primaryLight: 'rgba(63, 191, 186, 0.22)',
    secondary: '#1A1A1A',
    secondaryHover: '#222222',
    secondaryActive: '#2A2A2A',
    accent: '#FF6F00',
    accentHover: '#E66300',
    accentActive: '#CC5800',

    // Neutral
    bg: '#111111',
    bgPrimary: '#111111',
    bgSecondary: '#1A1A1A',
    bgHover: '#242424',
    text: '#E5E7EB',
    textSecondary: '#9CA3AF',
    card: '#1E1E1E',
    border: '#333333',
    divider: '#2A2A2A',

    // Semantic (base colors unchanged; only *Light variants differ)
    success: '#388E3C',
    successLight: '#064E3B',
    warning: '#FBC02D',
    warningLight: '#78350F',
    danger: '#D32F2F',
    dangerLight: '#7F1D1D',
    info: '#1976D2',
    infoLight: '#1E3A5F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Raw CSS shadow values (mode-dependent).
 * React Native needs platform-specific props
 * (shadowColor/shadowOffset/shadowOpacity/shadowRadius + elevation on Android) to render them.
 */
export const Shadows = {
  light: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.08)',
    md: '0 4px 12px rgba(0, 0, 0, 0.1)',
    lg: '0 12px 28px rgba(0, 0, 0, 0.15)',
  },
  dark: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.45)',
    md: '0 4px 12px rgba(0, 0, 0, 0.55)',
    lg: '0 12px 28px rgba(0, 0, 0, 0.65)',
  },
} as const;
