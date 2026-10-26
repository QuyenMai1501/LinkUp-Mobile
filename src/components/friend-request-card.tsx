import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

type FriendRequestCardProps = {
  avatarUri?: string;
  displayName: string;
  direction: 'sent' | 'received';
  onAccept?: () => void;
  onReject?: () => void;
  onRevoke?: () => void;
  loading?: boolean;
  /** Bấm avatar/tên → vào hồ sơ người gửi lời mời. */
  onProfilePress?: () => void;
};

export default function FriendRequestCard({
  avatarUri,
  displayName,
  direction,
  onAccept,
  onReject,
  onRevoke,
  loading = false,
  onProfilePress,
}: FriendRequestCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.identityRow}>
        <Pressable
          style={[styles.avatar, { backgroundColor: theme.primaryLight }]}
          hitSlop={4}
          onPress={onProfilePress}>
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
        </Pressable>

        <View style={styles.meta}>
          <Pressable hitSlop={4} onPress={onProfilePress}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {displayName}
            </ThemedText>
          </Pressable>
          <ThemedText themeColor="textSecondary" style={styles.directionLabel}>
            {direction === 'received' ? t('friends.request.wantsToAdd') : t('friends.request.sentRequest')}
          </ThemedText>
        </View>

        {direction === 'sent' && (
          <Pressable
            onPress={onRevoke}
            disabled={loading}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: 'transparent', borderColor: theme.border },
              pressed && styles.actionPressed,
            ]}>
            {loading ? (
              <ActivityIndicator color={theme.textSecondary} size="small" />
            ) : (
              <ThemedText style={[styles.actionBtnRevoke, { color: theme.textSecondary }]}>
                {t('friends.actions.revoke')}
              </ThemedText>
            )}
          </Pressable>
        )}
      </View>

      {direction === 'received' && (
        <View style={styles.actions}>
          <Pressable
            onPress={onAccept}
            disabled={loading}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBtnGrow,
              { backgroundColor: theme.primary, borderColor: theme.primary },
              pressed && styles.actionPressed,
            ]}>
            {loading ? (
              <ActivityIndicator color={theme.textOnPrimary} size="small" />
            ) : (
              <ThemedText style={[styles.actionBtnAccept, { color: theme.textOnPrimary }]}>{t('friends.actions.accept')}</ThemedText>
            )}
          </Pressable>
          <Pressable
            onPress={onReject}
            disabled={loading}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBtnGrow,
              { backgroundColor: 'transparent', borderColor: theme.border },
              pressed && styles.actionPressed,
            ]}>
            <ThemedText style={[styles.actionBtnReject, { color: theme.textSecondary }]}>
              {t('friends.actions.decline')}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    ...Typography.h2,
    fontSize: 16,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.body,
    fontWeight: 600,
    fontSize: 15,
  },
  directionLabel: {
    ...Typography.caption,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtnGrow: {
    flex: 1,
  },
  actionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 1,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionBtnAccept: {
    ...Typography.caption,
    fontWeight: 600,
    lineHeight: 20,
  },
  actionBtnReject: {
    ...Typography.caption,
    fontWeight: 600,
    lineHeight: 20,
  },
  actionBtnRevoke: {
    ...Typography.caption,
    fontWeight: 600,
    lineHeight: 20,
  },
});
