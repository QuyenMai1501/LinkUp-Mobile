/**
 * Compatibility shim for template components.
 * New code should import directly from ./colors, ./spacing, ./typography.
 * The legacy aliases below (background, backgroundElement, backgroundSelected,
 * Spacing.half/one/two/...) exist only so existing components keep working.
 */

import '@/global.css';

import { Colors as BaseColors } from './colors';
import {
  Spacing as BaseSpacing,
  Radius,
  BottomTabInset,
  MaxContentWidth,
} from './spacing';
import { Fonts, Typography } from './typography';

export const Colors = {
  light: {
    ...BaseColors.light,
    background: BaseColors.light.bg,
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
  },
  dark: {
    ...BaseColors.dark,
    background: BaseColors.dark.bg,
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  ...BaseSpacing,
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export { Radius, BottomTabInset, MaxContentWidth, Fonts, Typography };
