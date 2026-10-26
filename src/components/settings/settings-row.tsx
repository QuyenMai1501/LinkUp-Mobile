import { type ReactNode } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { type IconName } from '@/constants/icon-map';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';

export type SettingsTone = 'primary' | 'accent' | 'info' | 'success' | 'danger';

type SettingsRowProps = {
  icon: IconName;
  tone: SettingsTone;
  label: string;
  hint?: string;
  /** Bọc card đứng riêng (bg card + viền 1px + radius 12). Bỏ khi nằm trong card nhóm. */
  card?: boolean;
  onPress?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function SettingsRow({
  icon,
  tone,
  label,
  hint,
  card,
  onPress,
  children,
  style,
}: SettingsRowProps) {
  const colors = useTheme();

  const toneFg = {
    primary: colors.primary,
    accent: colors.accent,
    info: colors.info,
    success: colors.success,
    danger: colors.danger,
  }[tone];
  const toneBg = {
    primary: colors.primaryLight,
    accent: colors.accentLight,
    info: colors.infoLight,
    success: colors.successLight,
    danger: colors.dangerLight,
  }[tone];

  const body = (
    <>
      <View style={[styles.tile, { backgroundColor: toneBg }]}>
        <Icon name={icon} size={18} color={toneFg} />
      </View>
      <View style={styles.info}>
        <ThemedText style={[styles.label, tone === 'danger' && { color: toneFg }]}>
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            {hint}
          </ThemedText>
        ) : null}
      </View>
      {children ??
        (onPress ? (
          <Icon name="chevronRight" size={18} color={colors.textSecondary} />
        ) : null)}
    </>
  );

  const containerStyle = [
    styles.row,
    card && styles.card,
    card && { backgroundColor: colors.card, borderColor: colors.border },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={containerStyle}>
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={containerStyle}>{body}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  card: { borderRadius: 12, borderWidth: 1 },
  tile: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13 },
});
