/**
 * Returns the active color palette for the current theme mode.
 * Falls back to the system color scheme when no ThemeModeProvider is present.
 */

import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/contexts/theme-context';

export function useTheme() {
  const { scheme } = useThemeMode();

  return Colors[scheme];
}
