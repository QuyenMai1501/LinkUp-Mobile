import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FriendCardProps = {
  avatarUri?: string;
  displayName: string;
  subtitle?: string;
  actionLabel: string;
  actionIcon?: ReactNode;
  onAction: () => void;
  actionLoading?: boolean;
  actionVariant?: 'primary' | 'danger' | 'ghost';
  actionDisabled?: boolean;
  /** Bấm vào cả thẻ (dùng cho selection, vd chọn bạn bè để chia sẻ). */
  onPress?: () => void;
  /** Thay nút hành động mặc định bằng node tùy chọn (vd ô tick chọn). */
  action?: ReactNode;
};

export default function FriendCard({
  avatarUri,
  displayName,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
  actionLoading = false,
  actionVariant = 'primary',
  actionDisabled = false,
  onPress,
  action,
}: FriendCardProps) {
  const theme = useTheme();

  const actionBg =
    actionVariant === 'danger'
      ? theme.danger
      : actionVariant === 'ghost'
        ? 'transparent'
        : theme.primary;
  const actionBorder =
    actionVariant === 'danger'
      ? theme.danger
      : actionVariant === 'ghost'
        ? theme.border
        : theme.primary;
  const actionTextColor =
    actionVariant === 'danger'
      ? '#FFFFFF'
      : actionVariant === 'ghost'
        ? theme.textSecondary
        : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        pressed && onPress && styles.cardPressed,
      ]}>
      <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={styles.avatarImage}
            contentFit="cover"
          />
        ) : (
          <ThemedText style={[styles.avatarFallback, { color: theme.primary }]}>
            {displayName.charAt(0).toUpperCase()}
          </ThemedText>
        )}
      </View>

      <View style={styles.meta}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {displayName}
        </ThemedText>
        {subtitle ? (
          <ThemedText themeColor="textSecondary" style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      {action ?? (
        <Pressable
          onPress={onAction}
          disabled={actionDisabled || actionLoading}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: actionBg,
              borderColor: actionBorder,
            },
            pressed && !actionDisabled && styles.actionPressed,
            actionDisabled && styles.actionDisabled,
          ]}>
          {actionLoading ? (
            <ActivityIndicator color={actionTextColor} size="small" />
          ) : (
            <ThemedText style={[styles.actionLabel, { color: actionTextColor }]}>
              {actionIcon ? (
                <>
                  {actionIcon}
                  {' '}
                  {actionLabel}
                </>
              ) : (
                actionLabel
              )}
            </ThemedText>
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  cardPressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    ...Typography.h2,
    fontSize: 18,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.body,
    fontWeight: 600,
  },
  subtitle: {
    ...Typography.caption,
  },
  actionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    ...Typography.caption,
    fontWeight: 600,
    lineHeight: 20,
  },
});
