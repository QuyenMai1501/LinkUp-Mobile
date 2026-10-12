import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getGroupSharedContent } from '@/api/group-chat';
import { MediaLightbox } from '@/components/chat/media-lightbox';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage } from '@/types/chat';
import type {
  SharedContent,
  SharedContentTab,
} from '@/types/group-chat';

const TABS: SharedContentTab[] = ['media', 'files', 'links', 'posts'];

const TAB_LABEL_KEYS: Record<SharedContentTab, string> = {
  media: 'chat.sharedMedia',
  files: 'chat.sharedFiles',
  links: 'chat.sharedLinks',
  posts: 'chat.sharedPosts',
};

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** SharedMediaItem → ChatMessage giả để tái dùng MediaLightbox. */
function toLightboxMessages(content: SharedContent): ChatMessage[] {
  return content.media.map((m) => ({
    id: m.message_id,
    chat_id: '',
    sender_id: '',
    content: '',
    media_id: m.media_id,
    media_uri: m.file_uri,
    media_type: m.file_type,
    duration_seconds: m.duration_seconds || null,
    is_anonymized: false,
    created_at: m.created_at,
  }));
}

export default function GroupSharedContentScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SharedContentTab>('media');
  const [content, setContent] = useState<SharedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const prevLoadingRef = useRef(false);

  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    // setLoading(true) ngoài promise — tránh set-state sync trong effect.
    if (!prevLoadingRef.current) {
      prevLoadingRef.current = true;
      setLoading(true);
    }
    getGroupSharedContent(chatId)
      .then((res) => {
        if (cancelled) return;
        setContent(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        prevLoadingRef.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const lightboxMessages = content ? toLightboxMessages(content) : [];

  const handleOpenUrl = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {});
  }, []);

  const renderEmpty = () => (
    <View style={styles.center}>
      <ThemedText themeColor="textSecondary">{t('chat.sharedEmpty')}</ThemedText>
    </View>
  );

  const renderMedia = () => {
    const media = content?.media ?? [];
    if (media.length === 0) return renderEmpty();
    return (
      <FlatList
        data={media}
        keyExtractor={(item) => item.message_id}
        numColumns={3}
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.mediaCell}
            onPress={() => setLightboxIndex(index)}>
            <Image
              source={{ uri: item.file_uri }}
              style={styles.mediaImage}
              contentFit="cover"
            />
            {!item.file_type?.startsWith('image/') && (
              <View style={styles.mediaBadge}>
                <Icon name="play" size={14} color="#FFF" />
              </View>
            )}
          </Pressable>
        )}
        contentContainerStyle={styles.gridContent}
      />
    );
  };

  const renderFiles = () => {
    const files = content?.files ?? [];
    if (files.length === 0) return renderEmpty();
    return (
      <FlatList
        data={files}
        keyExtractor={(item) => item.message_id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, { borderBottomColor: theme.border }]}
            onPress={() => handleOpenUrl(item.file_uri)}>
            <Icon name="document" size={18} color={theme.primary} />
            <View style={styles.rowInfo}>
              <ThemedText style={{ color: theme.text }} numberOfLines={1}>
                {item.file_name || t('chat.attachment')}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.rowMeta}>
                {[item.file_type, formatFileSize(item.file_size)]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            </View>
            <Icon name="share" size={16} color={theme.textSecondary} />
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  const renderLinks = () => {
    const links = content?.links ?? [];
    if (links.length === 0) return renderEmpty();
    return (
      <FlatList
        data={links}
        keyExtractor={(item) => item.message_id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, { borderBottomColor: theme.border }]}
            onPress={() => handleOpenUrl(item.url)}>
            <Icon name="link" size={18} color={theme.primary} />
            <ThemedText
              style={{ flex: 1, color: theme.primary }}
              numberOfLines={2}>
              {item.url}
            </ThemedText>
            <Icon name="share" size={16} color={theme.textSecondary} />
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  const renderPosts = () => {
    const posts = content?.posts ?? [];
    if (posts.length === 0) return renderEmpty();
    return (
      <FlatList
        data={posts}
        keyExtractor={(item) => item.message_id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, { borderBottomColor: theme.border }]}
            onPress={() =>
              (router as any).push({
                pathname: '/(drawer)/post/[postId]',
                params: { postId: item.post_id },
              })
            }>
            <Icon name="newspaper" size={18} color={theme.primary} />
            <ThemedText style={{ flex: 1, color: theme.text }} numberOfLines={3}>
              {item.post_content || t('chat.attachment')}
            </ThemedText>
            <Icon name="chevronRight" size={16} color={theme.textSecondary} />
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.bg }]}
      edges={['top']}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.border, backgroundColor: theme.bg },
        ]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backBtn}>
          <ThemedText style={styles.backIcon}>←</ThemedText>
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
          {t('chat.sharedContent')}
        </ThemedText>
        <View style={styles.backBtn} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, active && { borderBottomColor: theme.primary }]}>
              <ThemedText
                style={{
                  color: active ? theme.primary : theme.textSecondary,
                  fontWeight: active ? '700' : '500',
                  fontSize: 13,
                }}>
                {t(TAB_LABEL_KEYS[tab])}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : !content ? (
        renderEmpty()
      ) : activeTab === 'media' ? (
        renderMedia()
      ) : activeTab === 'files' ? (
        renderFiles()
      ) : activeTab === 'links' ? (
        renderLinks()
      ) : (
        renderPosts()
      )}

      {/* Media lightbox */}
      {lightboxIndex !== null && lightboxMessages.length > 0 && (
        <MediaLightbox
          visible={true}
          messages={lightboxMessages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#000',
  },
  headerTitle: {
    ...Typography.body,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    padding: 1,
  },
  mediaCell: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 1,
  },
  mediaImage: {
    flex: 1,
    borderRadius: 4,
  },
  mediaBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 4,
  },
  listContent: {
    paddingBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowInfo: {
    flex: 1,
    gap: 1,
  },
  rowMeta: {
    fontSize: 11,
  },
});
