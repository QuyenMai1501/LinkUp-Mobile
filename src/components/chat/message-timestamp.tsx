import { StyleSheet } from 'react-native';

import { metaPillStyle } from '@/components/chat/meta-pill';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatClockTime } from '@/utils/chat';

/**
 * Timestamp HH:mm dưới bubble — mirror Web `MessageTimestamp` trên thiết bị
 * cảm ứng: 11px muted, opacity 0.5, bám phía bubble (phải nếu tin của mình).
 * Khi có wallpaper (`onBackground`), timestamp chuyển thành pill nền giống
 * bubble để không chìm vào nền trò chuyện.
 */
export function MessageTimestamp({
  createdAt,
  isMine,
  onBackground = false,
  bubbleBg,
  bubbleFg,
}: {
  createdAt: string;
  isMine: boolean;
  /** true = có wallpaper → render pill thay vì chữ mờ trên nền. */
  onBackground?: boolean;
  /** Màu nền bubble thực tế (mặc định: primary/card theo người gửi). */
  bubbleBg?: string;
  /** Màu chữ tương ứng bubble (mặc định: textOnPrimary/text). */
  bubbleFg?: string;
}) {
  const theme = useTheme();
  const label = formatClockTime(createdAt);
  if (!label) return null;
  const pillBg = bubbleBg ?? (isMine ? theme.primary : theme.card);
  const pillFg = bubbleFg ?? (isMine ? theme.textOnPrimary : theme.text);
  return (
    <ThemedText
      style={[
        styles.time,
        onBackground
          ? metaPillStyle(true, pillBg, pillFg)
          : { color: theme.textSecondary },
        { alignSelf: isMine ? 'flex-end' : 'flex-start' },
      ]}>
      {label}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  time: {
    fontSize: 11,
    lineHeight: 13,
    opacity: 0.5,
    marginTop: 2,
  },
});
