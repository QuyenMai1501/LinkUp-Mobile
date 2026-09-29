import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getVideoThumbnail, getYouTubeVideoId } from '@/utils/videoLink';

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getTitle(url: string): string | null {
  const ytId = getYouTubeVideoId(url);
  if (ytId) return 'YouTube Video';
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    if (path && path !== '/') {
      const slug = path.split('/').pop() ?? '';
      return decodeURIComponent(slug).replace(/[-_]/g, ' ');
    }
  } catch {
    // Bỏ qua URL không parse được.
  }
  return null;
}

interface Props {
  url: string;
}

export function VideoLinkPreview({ url }: Props) {
  const theme = useTheme();
  const thumbnail = useMemo(() => getVideoThumbnail(url), [url]);
  const domain = useMemo(() => getDomain(url), [url]);
  const title = useMemo(() => getTitle(url), [url]);
  const [thumbFailed, setThumbFailed] = useState(false);

  const handleOpen = () => {
    Linking.openURL(url).catch(() => {});
  };

  const showThumb = thumbnail && !thumbFailed;

  return (
    <Pressable
      onPress={handleOpen}
      style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
      accessibilityRole="link"
      accessibilityLabel={url}>
      <View style={styles.thumbWrap}>
        {showThumb ? (
          <Image
            source={{ uri: thumbnail }}
            style={styles.thumb}
            contentFit="cover"
            transition={150}
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: theme.bgSecondary }]}>
            <Icon name="video" size={28} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.playBadge}>
          <Icon name="play" size={16} color="#FFF" />
        </View>
      </View>
      <View style={styles.info}>
        <ThemedText style={[styles.domain, { color: theme.textSecondary }]} numberOfLines={1}>
          {domain}
        </ThemedText>
        {title && (
          <ThemedText style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {title}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: 4,
  },
  thumbWrap: {
    width: '100%',
    height: 135,
    backgroundColor: '#000',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    gap: 2,
  },
  domain: {
    ...Typography.caption,
    fontSize: 11,
  },
  title: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
  },
});
