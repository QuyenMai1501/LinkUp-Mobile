import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { useMessageMedia } from '@/hooks/useMessageMedia';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { Radius } from '@/constants/theme';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage;
  onPress?: () => void;
}

export function MessageMedia({ message, onPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { src, isVideo, failed, loading } = useMessageMedia(message);
  const [ratio, setRatio] = useState<{ width: number; height: number } | null>(null);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bgSecondary }]}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  if (failed || !src) {
    return (
      <View style={[styles.failed, { backgroundColor: theme.bgSecondary }]}>
        <ThemedText style={[styles.failedText, { color: theme.textSecondary }]}>
          {t('chat.mediaFailed')}
        </ThemedText>
      </View>
    );
  }

  if (isVideo) {
    return (
      <Pressable onPress={onPress} style={styles.videoWrap}>
        <View style={[styles.videoPlaceholder, { backgroundColor: theme.bgSecondary }]}>
          <ThemedText style={[styles.videoIcon, { color: theme.textSecondary }]}>▶</ThemedText>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.imageWrap}>
      <Image
        source={{ uri: src }}
        style={[
          styles.image,
          ratio ? { aspectRatio: ratio.width / ratio.height } : styles.imageDefault,
        ]}
        contentFit="cover"
        transition={200}
        onLoad={(e) => {
          const { width, height } = e.source;
          if (width && height) setRatio({ width, height });
        }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: {
    width: 200,
    height: 150,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failed: {
    width: 200,
    height: 60,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedText: {
    fontSize: 12,
  },
  videoWrap: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    width: 240,
    height: 180,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIcon: {
    fontSize: 40,
  },
  imageWrap: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  image: {
    width: 240,
    borderRadius: Radius.md,
  },
  imageDefault: {
    height: 180,
  },
});
