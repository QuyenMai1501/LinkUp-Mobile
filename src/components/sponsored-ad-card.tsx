import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';

import { trackAdAction } from '@/api/partner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { FeedAd } from '@/types/partner';

/** Card quảng cáo chèn vào feed — impression do feed track qua viewability. */
export default function SponsoredAdCard({ ad }: { ad: FeedAd }) {
  const colors = useTheme();
  const { t } = useTranslation();

  const handlePressCta = () => {
    trackAdAction(ad.id, 'click').catch(() => {});
    if (ad.target_url) Linking.openURL(ad.target_url).catch(() => {});
  };

  return (
    <ThemedView
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}>
      <View style={styles.badgeWrap}>
        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
          <ThemedText
            type="small"
            style={[styles.badgeText, { color: colors.textSecondary }]}>
            {t('feed.sponsored')}
          </ThemedText>
        </View>
      </View>
      {ad.media_uri ? (
        <Image
          source={{ uri: ad.media_uri }}
          style={styles.image}
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
  badgeWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  image: {
    width: '100%',
    height: 180,
    marginTop: Spacing.sm,
  },
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
