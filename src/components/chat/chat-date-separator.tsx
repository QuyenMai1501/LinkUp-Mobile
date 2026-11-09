import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatChatDate } from '@/utils/chat';

/**
 * Ngăn cách ngày trong chat — pill nổi canh giữa, mirror Web `.dateSep`:
 * nền card + viền + shadow nhẹ, chữ 12px/500 muted; nội dung formatChatDate
 * (`Hôm nay` / `Hôm qua` / `dd/mm/yyyy`).
 */
export function ChatDateSeparator({ createdAt }: { createdAt: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const label = formatChatDate(createdAt, t);
  if (!label) return null;
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.pill,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <ThemedText style={[styles.text, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});
