import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useServerEmojis } from '@/hooks/use-server-emojis';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { StoryAnalytics } from '@/types/story';

function formatTimeAgo(
  dateStr: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t('post.justNow');
  if (mins < 60) return t('post.minutesAgo', { minutes: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('post.hoursAgo', { hours: hrs });
  return t('post.daysAgo', { days: Math.floor(hrs / 24) });
}

interface StoryStatsModalProps {
  visible: boolean;
  analytics: StoryAnalytics | null;
  loading: boolean;
  error: boolean;
  onClose: () => void;
}

export default function StoryStatsModal({
  visible,
  analytics,
  loading,
  error,
  onClose,
}: StoryStatsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { byId } = useServerEmojis();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: Spacing.xl + insets.bottom }]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <View style={styles.headerRow}>
          <ThemedText style={styles.title}>{t('story.analytics')}</ThemedText>
          <Pressable hitSlop={8} onPress={onClose}>
            <Icon name="close" size={24} />
          </Pressable>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {error && !loading && (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">{t('story.analyticsError')}</ThemedText>
          </View>
        )}

        {!loading && !error && analytics && (
          <>
            <View style={styles.totals}>
              <View style={styles.totalItem}>
                <ThemedText style={styles.totalValue}>{analytics.total_views}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.totalLabel}>
                  {t('story.views')}
                </ThemedText>
              </View>
              <View style={styles.totalItem}>
                <ThemedText style={styles.totalValue}>{analytics.total_reacts}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.totalLabel}>
                  {t('story.reacts')}
                </ThemedText>
              </View>
              <View style={styles.totalItem}>
                <ThemedText style={styles.totalValue}>{analytics.total_replies}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.totalLabel}>
                  {t('story.replies')}
                </ThemedText>
              </View>
              <View style={styles.totalItem}>
                <ThemedText style={styles.totalValue}>{analytics.total_shares}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.totalLabel}>
                  {t('story.shares')}
                </ThemedText>
              </View>
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {analytics.viewers.length === 0 && (
                <ThemedText themeColor="textSecondary" style={styles.empty}>
                  {t('story.noViews')}
                </ThemedText>
              )}
              {analytics.viewers.map((v) => {
                const emoji = v.emoji_id ? byId?.get(v.emoji_id) : undefined;
                return (
                  <View key={v.user_id} style={styles.viewerRow}>
                    {v.avatar_uri?.trim() ? (
                      <Image source={{ uri: v.avatar_uri }} style={styles.viewerAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.viewerAvatar, styles.viewerAvatarFallback]}>
                        <Icon name="person" size={18} color={theme.textOnPrimary} />
                      </View>
                    )}
                    <View style={styles.viewerInfo}>
                      <ThemedText style={styles.viewerName} numberOfLines={1}>
                        {v.display_name || v.user_id}
                      </ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.viewerTime}>
                        {formatTimeAgo(v.viewed_at, t)}
                      </ThemedText>
                      {v.messages.length > 0 && (
                        <ThemedText themeColor="textSecondary" style={styles.viewerMsg} numberOfLines={2}>
                          {v.messages.join(' · ')}
                        </ThemedText>
                      )}
                    </View>
                    {emoji && (
                      <Image source={{ uri: emoji.image_uri }} style={styles.viewerEmoji} contentFit="contain" />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: { ...Typography.h2, fontWeight: '700', fontSize: 18 },
  center: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  totals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.3)',
  },
  totalItem: { alignItems: 'center' },
  totalValue: { ...Typography.body, fontWeight: '700', fontSize: 18 },
  totalLabel: { ...Typography.caption },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 12,
    paddingBottom: Spacing.md,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 24,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  viewerAvatarFallback: {
    backgroundColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  viewerTime: {
    fontSize: 12,
  },
  viewerMsg: {
    fontSize: 12,
    marginTop: 2,
  },
  viewerEmoji: {
    width: 24,
    height: 24,
  },
});
