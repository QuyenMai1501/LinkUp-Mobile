import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import type { MediaItem } from '@/types/profile';

interface MediaLightboxProps {
  items: MediaItem[];
  initialIndex: number;
  onClose: () => void;
  onNavigate?: (postId: string) => void;
}

export function MediaLightbox({ items, initialIndex, onClose, onNavigate }: MediaLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const item = items[index];

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.content}>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Icon name="close" size={20} color="#FFFFFF" />
        </Pressable>

        <Image source={{ uri: item.file_uri }} style={styles.media} resizeMode="contain" />

        <View style={styles.footer}>
          <ThemedText style={styles.counter}>
            {index + 1} / {items.length}
          </ThemedText>
          {onNavigate && (
            <Pressable onPress={() => onNavigate(item.post_id)} style={styles.viewPostBtn}>
              <ThemedText style={styles.viewPostText}>View Post</ThemedText>
            </Pressable>
          )}
        </View>

        {index > 0 && (
          <Pressable style={styles.navLeft} onPress={() => setIndex(index - 1)}>
            <ThemedText style={styles.navArrow}>‹</ThemedText>
          </Pressable>
        )}
        {index < items.length - 1 && (
          <Pressable style={styles.navRight} onPress={() => setIndex(index + 1)}>
            <ThemedText style={styles.navArrow}>›</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  media: { width: '90%', height: '70%' },
  footer: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  counter: { color: '#FFFFFF', ...Typography.body },
  viewPostBtn: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm },
  viewPostText: { ...Typography.body, fontWeight: 600, color: '#FFFFFF' },
  navLeft: {
    position: 'absolute',
    left: 10,
    top: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRight: {
    position: 'absolute',
    right: 10,
    top: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: { fontSize: 28, color: '#FFFFFF', fontWeight: '300' },
});
