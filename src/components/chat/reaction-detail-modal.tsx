import { Image } from 'expo-image';
import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage } from '@/types/chat';
import type { EmojiItem } from '@/types/post';
import {
  summarizeReactions,
  type LocalReactionCounts,
} from '@/utils/reactions';

/** Tên + avatar đã resolve theo user_id (screen build từ data sẵn). */
export interface ReactionUserProfile {
  name: string;
  avatar: string | null;
}

interface Props {
  visible: boolean;
  /** Tin đang xem chi tiết — null → không render nội dung. */
  message: ChatMessage | null;
  /** Local counts của tin này (choices[msgId]) — undefined = chưa can thiệp. */
  localCounts: LocalReactionCounts | undefined;
  myUserId: string;
  /** Map emoji server (byId) để map emoji_id → char/code. */
  emojis: Map<string, EmojiItem> | null | undefined;
  /** user_id → { name, avatar } (group: memberNames/Avatars; 1-1: partner). */
  userProfiles: Record<string, ReactionUserProfile>;
  onClose: () => void;
}

/**
 * Modal chi tiết cảm xúc (bottom-sheet) — nhóm theo emoji: ký tự + số lượng,
 * bên dưới là danh sách người thả (avatar + tên). Mirror `story-stats-modal`.
 */
export function ReactionDetailModal({
  visible,
  message,
  localCounts,
  myUserId,
  emojis,
  userProfiles,
  onClose,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const groups = useMemo(() => {
    if (!message) return [];
    return summarizeReactions(message, myUserId, localCounts, emojis);
  }, [message, myUserId, localCounts, emojis]);

  return (
    <Modal
      visible={visible && !!message}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.background,
            paddingBottom: Spacing.xl + insets.bottom,
          },
        ]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <View style={styles.headerRow}>
          <ThemedText style={styles.title}>
            {t('chat.reactionsTitle')}
          </ThemedText>
          <Pressable hitSlop={8} onPress={onClose}>
            <Icon name="close" size={24} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>
          {groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupEmoji}>{g.char}</Text>
                <ThemedText
                  themeColor="textSecondary"
                  style={styles.groupCount}>
                  {g.count}
                </ThemedText>
              </View>
              {g.user_ids.map((uid) => {
                const profile = userProfiles[uid];
                const name = profile?.name || t('chat.unknown');
                const avatar = profile?.avatar ?? null;
                const initial = (name || '?')[0]?.toUpperCase() ?? '?';
                return (
                  <View key={uid} style={styles.userRow}>
                    {avatar ? (
                      <Image
                        source={{ uri: avatar }}
                        style={[
                          styles.avatar,
                          { backgroundColor: theme.bgSecondary },
                        ]}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatar,
                          styles.avatarFallback,
                          { backgroundColor: theme.primaryLight },
                        ]}>
                        <Text
                          style={[styles.avatarInitial, { color: theme.primary }]}>
                          {initial}
                        </Text>
                      </View>
                    )}
                    <ThemedText style={styles.userName} numberOfLines={1}>
                      {name}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.xs,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    fontSize: 18,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  group: {
    marginTop: Spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  groupEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  groupCount: {
    ...Typography.caption,
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...Typography.caption,
    fontWeight: '700',
  },
  userName: {
    flex: 1,
    ...Typography.body,
  },
});
