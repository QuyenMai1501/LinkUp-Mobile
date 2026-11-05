import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import VideoPlayer from '@/components/video-player';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { getUserMedia } from '@/api/profile';
import type { MediaItem } from '@/types/profile';
import { MediaLightbox } from './MediaLightbox';

function isVideo(fileType: string): boolean {
  return fileType.startsWith('video/');
}

interface ProfileMediaGridProps {
  userId: string;
}

export function ProfileMediaGrid({ userId }: ProfileMediaGridProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUserMedia(userId, 1, 18)
      .then((res) => {
        if (!cancelled) {
          // Server cũ trả data:null khi list rỗng → guard để không crash.
          setMedia(res.data ?? []);
          setHasMore(res.has_more);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    getUserMedia(userId, nextPage, 18)
      .then((res) => {
        setMedia((prev) => [...prev, ...(res.data ?? [])]);
        setHasMore(res.has_more);
        setPage(nextPage);
      })
      .catch(() => {});
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (media.length === 0) {
    return (
      <View style={styles.center}>
        <Icon name="images" size={48} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>{t('profile.noMedia')}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {media.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => setLightboxIndex(index)}
            style={styles.gridItem}>
            {/* Video URL không render được qua Image → frame đầu bằng expo-video (mirror web <video muted>). */}
            {isVideo(item.file_type) ? (
              <VideoPlayer uri={item.file_uri} interactive={false} />
            ) : (
              <Image source={{ uri: item.file_uri }} style={styles.gridFill} />
            )}
          </Pressable>
        ))}
      </View>
      {hasMore && (
        <Pressable onPress={loadMore} style={styles.loadMore}>
          <ThemedText style={[styles.loadMoreText, { color: theme.primary }]}>{t('common.loadMore')}</ThemedText>
        </Pressable>
      )}
      {lightboxIndex !== null && (
        <MediaLightbox
          items={media}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  gridItem: { width: '33.33%', aspectRatio: 1, borderRadius: 2, overflow: 'hidden' },
  gridFill: { width: '100%', height: '100%' },
  loadMore: { paddingVertical: Spacing.md, alignItems: 'center' },
  loadMoreText: { ...Typography.body, fontWeight: 600 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: { ...Typography.body },
});
