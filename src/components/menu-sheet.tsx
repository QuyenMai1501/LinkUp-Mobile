import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/constants/icon-map';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

export interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  danger?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  items: MenuItem[];
  onClose: () => void;
}

/**
 * Bottom sheet menu hành động (chrome giống share-options-sheet):
 * bấm item → đóng sheet trước rồi chạy onPress của item.
 */
export function MenuSheet({ visible, title, items, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetContainer}>
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          {title ? (
            <ThemedText themeColor="textSecondary" style={styles.title}>
              {title}
            </ThemedText>
          ) : null}

          {items.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.bgHover }]}
              onPress={() => {
                onClose();
                item.onPress();
              }}>
              <Icon
                name={item.icon}
                size={22}
                color={item.danger ? theme.danger : theme.text}
              />
              <ThemedText
                style={[styles.rowText, { color: item.danger ? theme.danger : theme.text }]}>
                {item.label}
              </ThemedText>
            </Pressable>
          ))}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Pressable
            style={({ pressed }) => [
              styles.row,
              styles.cancelRow,
              pressed && { backgroundColor: theme.bgHover },
            ]}
            onPress={onClose}>
            <ThemedText
              style={[styles.rowText, styles.cancelText, { color: theme.textSecondary }]}>
              {t('common.cancel')}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing.xl,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowText: {
    ...Typography.body,
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  cancelRow: {
    justifyContent: 'center',
  },
  cancelText: {
    fontWeight: '600',
  },
});
