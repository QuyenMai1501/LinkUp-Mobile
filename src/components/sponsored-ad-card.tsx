import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';

import { trackAdAction } from '@/api/partner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import ReportSheet from '@/components/report-sheet';
import VideoPlayer from '@/components/video-player';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { FeedAd, TrackActionType } from '@/types/partner';

function isVideoMedia(mediaType?: string): boolean {
  return !!mediaType?.startsWith('video');
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi|mkv)([?#]|$)/i.test(url);
}

export default function SponsoredAdCard({ ad }: { ad: FeedAd }) {
  const colors = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const trackedRef = useRef(new Set<string>());
  const [slide, setSlide] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [cardWidth, setCardWidth] = useState(width - Spacing.md * 2);

  const media = (ad.media_list ?? []).filter((item) => !!item.url);
  const items =
    media.length > 0
      ? media
      : ad.media_uri
        ? [
            {
              url: ad.media_uri,
              media_type:
                ad.format === 'video' || isVideoUrl(ad.media_uri)
                  ? 'video'
                  : 'image',
            },
          ]
        : [];
  const current = items[Math.min(slide, Math.max(items.length - 1, 0))];
  const isCarousel = ad.format === 'carousel' && items.length > 1;
  const isVideo =
    ad.format === 'video' ||
    isVideoMedia(current?.media_type) ||
    (!!current?.url && isVideoUrl(current.url));

  const track = (action: TrackActionType) => {
    if (trackedRef.current.has(action)) return;
    trackedRef.current.add(action);
    trackAdAction(ad.id, action).catch(() => {});
  };

  useEffect(() => {
    if (isVideo) track('video_start');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad.id, isVideo]);

  const handlePressCta = () => {
    track('click');
    if (ad.target_url) Linking.openURL(ad.target_url).catch(() => {});
  };

  return (
    <ThemedView
      onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}>
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
          <ThemedText
            type="small"
            style={[styles.badgeText, { color: colors.textSecondary }]}>
            {t('feed.sponsored')}
          </ThemedText>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          hitSlop={8}
          onPress={() => setReportOpen(true)}>
          <Icon name="flag" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {current && isVideo ? (
        <VideoPlayer
          uri={current.url}
          style={styles.media}
          muted
          loop={false}
          nativeControls
          onEnd={() => track('video_end')}
          onTap={() => track('video_start')}
        />
      ) : isCarousel ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const next = Math.round(
                event.nativeEvent.contentOffset.x / Math.max(cardWidth, 1),
              );
              if (next !== slide) {
                setSlide(next);
                track('swipe');
              }
            }}>
            {items.map((item) => (
              <Image
                key={item.url}
                source={{ uri: item.url }}
                style={[styles.media, { width: cardWidth }]}
                contentFit="cover"
                transition={150}
              />
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {items.map((item, index) => (
              <View
                key={item.url}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      index === slide ? colors.primary : colors.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ) : current ? (
        <Image
          source={{ uri: current.url }}
          style={styles.media}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      <View style={styles.content}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {ad.title}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          numberOfLines={4}
          style={styles.text}>
          {ad.content}
        </ThemedText>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.cta, { backgroundColor: colors.primary }]}
          onPress={handlePressCta}>
          <ThemedText style={[styles.ctaText, { color: colors.textOnPrimary }]}>
            {t('feed.sponsoredCta')}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {reportOpen && (
        <ReportSheet
          targetType="ad"
          targetId={ad.id}
          onClose={() => setReportOpen(false)}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  media: {
    width: '100%',
    height: 180,
    marginTop: Spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  content: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  text: { lineHeight: 20 },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  ctaText: { fontSize: 14, fontWeight: '600' },
});
