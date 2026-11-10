import type { TextStyle } from 'react-native';

import { Radius } from '@/constants/theme';

/**
 * Pill nhỏ cho metadata chat (timestamp / trạng thái Đang gửi, Đã gửi, Đã xem)
 * khi có wallpaper — nền đục giống bubble để chữ không chìm vào nền trò chuyện.
 */
export function metaPillStyle(
  onBackground: boolean,
  backgroundColor: string,
  color: string,
): TextStyle | null {
  if (!onBackground) return null;
  return {
    opacity: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor,
    color,
  };
}
