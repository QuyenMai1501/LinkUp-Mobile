import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { useMessageMedia } from '@/hooks/useMessageMedia';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage } from '@/types/chat';

interface Props {
  visible: boolean;
  messages: ChatMessage[];
  initialIndex: number;
  onClose: () => void;
}

export function MediaLightbox({ visible, messages, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const msg = messages[index];

  if (!msg) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <ThemedText style={styles.closeIcon}>✕</ThemedText>
        </Pressable>

        <View style={styles.content}>
          <MediaView key={msg.id} message={msg} />
        </View>

        {msg.content?.trim() && (
          <View style={[styles.caption, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <ThemedText style={styles.captionText}>{msg.content}</ThemedText>
          </View>
        )}

        <View style={styles.footer}>
          {messages.length > 1 && (
            <ThemedText style={styles.counter}>
              {index + 1} / {messages.length}
            </ThemedText>
          )}
        </View>

        {index > 0 && (
          <Pressable style={styles.prevBtn} onPress={() => setIndex((i) => i - 1)}>
            <ThemedText style={styles.navIcon}>‹</ThemedText>
          </Pressable>
        )}
        {index < messages.length - 1 && (
          <Pressable style={styles.nextBtn} onPress={() => setIndex((i) => i + 1)}>
            <ThemedText style={styles.navIcon}>›</ThemedText>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

function MediaView({ message }: { message: ChatMessage }) {
  const { src, isVideo, failed, loading } = useMessageMedia(message);
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={styles.mediaLoading}>
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  if (failed || !src) {
    return (
      <View style={styles.mediaLoading}>
        <ThemedText style={styles.mediaFailed}>{t('chat.mediaFailed')}</ThemedText>
      </View>
    );
  }

  if (isVideo) {
    return <ThemedText style={styles.mediaFailed}>Video preview not available</ThemedText>;
  }

  return (
    <Image source={{ uri: src }} style={styles.lightboxImage} contentFit="contain" transition={200} />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  caption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  captionText: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 40,
  },
  counter: {
    color: '#FFF',
    fontSize: 14,
    opacity: 0.7,
  },
  prevBtn: {
    position: 'absolute',
    left: 10,
    top: '50%',
    marginTop: -30,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -30,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: '300',
  },
  mediaLoading: {
    width: 280,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaFailed: {
    color: '#FFF',
    fontSize: 14,
    opacity: 0.7,
  },
  lightboxImage: {
    width: 300,
    height: 400,
  },
});
