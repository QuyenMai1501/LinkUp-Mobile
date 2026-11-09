import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatClockTime } from '@/utils/chat';

/**
 * Timestamp HH:mm dưới bubble — mirror Web `MessageTimestamp` trên thiết bị
 * cảm ứng: 11px muted, opacity 0.5, bám phía bubble (phải nếu tin của mình).
 */
export function MessageTimestamp({
  createdAt,
  isMine,
}: {
  createdAt: string;
  isMine: boolean;
}) {
  const theme = useTheme();
  const label = formatClockTime(createdAt);
  if (!label) return null;
  return (
    <ThemedText
      style={[
        styles.time,
        {
          color: theme.textSecondary,
          alignSelf: isMine ? 'flex-end' : 'flex-start',
        },
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
