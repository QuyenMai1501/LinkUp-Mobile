import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
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
  REACTION_EMOJIS,
  activeChoicesFor,
  summarizeByUser,
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
  /** Gỡ reaction CỦA MÌNH trong tab "Tất cả" (local-only). */
  onRemoveMine?: (codes: string[]) => void;
  /** Thả cảm xúc từ picker ngay trong modal (giữ modal, list tự refresh). */
  onReact?: (code: string) => void;
  onClose: () => void;
}

const TAB_ALL = 'all';

/**
 * Modal chi tiết cảm xúc (bottom-sheet) theo TAB: "Tất cả" + 6 emoji.
 * - Tất cả: liệt kê theo USER — avatar, tên, các loại reaction đã thả;
 *   dòng của mình có nút ✕ gỡ (local-only).
 * - Tab emoji: danh sách người thả emoji đó.
 */
export function ReactionDetailModal({
  visible,
  message,
  localCounts,
  myUserId,
  emojis,
  userProfiles,
  onRemoveMine,
  onReact,
  onClose,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<string>(TAB_ALL);

  const handleClose = () => {
    setTab(TAB_ALL);
    onClose();
  };

  const byUser = useMemo(() => {
    if (!message) return [];
    return summarizeByUser(message, myUserId, localCounts, emojis);
  }, [message, myUserId, localCounts, emojis]);

  const summary = useMemo(() => {
    if (!message) return [];
    return summarizeReactions(message, myUserId, localCounts, emojis);
  }, [message, myUserId, localCounts, emojis]);

  // Highlight picker: code mình đang thả (union local + server, bỏ tombstone).
  const activeCodes = useMemo(() => {
    if (!message) return [];
    return activeChoicesFor(message, myUserId, localCounts, emojis);
  }, [message, myUserId, localCounts, emojis]);

  const tabGroup = tab === TAB_ALL ? null : summary.find((g) => g.key === tab);

  const renderAvatar = (uid: string) => {
    const profile = userProfiles[uid];
    const name = profile?.name || t('chat.unknown');
    const avatar = profile?.avatar ?? null;
    const initial = (name || '?')[0]?.toUpperCase() ?? '?';
    if (avatar) {
      return (
        <Image
          source={{ uri: avatar }}
          style={[styles.avatar, { backgroundColor: theme.bgSecondary }]}
          contentFit="cover"
        />
      );
    }
    return (
      <View
        style={[
          styles.avatar,
          styles.avatarFallback,
          { backgroundColor: theme.primaryLight },
        ]}>
        <Text style={[styles.avatarInitial, { color: theme.primary }]}>
          {initial}
        </Text>
      </View>
    );
  };

  const renderName = (uid: string) => {
    const profile = userProfiles[uid];
    return (
      <ThemedText style={styles.userName} numberOfLines={1}>
        {profile?.name || t('chat.unknown')}
      </ThemedText>
    );
  };

  return (
    <Modal
      visible={visible && !!message}
      transparent
      animationType="slide"
      onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
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
          <Pressable hitSlop={8} onPress={handleClose}>
            <Icon name="close" size={24} />
          </Pressable>
        </View>

        {/* Picker 6 emoji — thả ngay trong modal, list tự refresh */}
        <View style={styles.pickerRow}>
          {REACTION_EMOJIS.map((emoji) => {
            const active = activeCodes.includes(emoji.code);
            return (
              <Pressable
                key={emoji.code}
                accessibilityLabel={`Thả cảm xúc ${emoji.char}`}
                onPress={() => onReact?.(emoji.code)}
                style={[
                  styles.pickerBtn,
                  active && {
                    backgroundColor: theme.primaryLight,
                    borderColor: theme.primary,
                  },
                ]}>
                <Text style={styles.pickerEmoji}>{emoji.char}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Hàng tab: Tất cả + 6 emoji */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}>
          <Pressable
            onPress={() => setTab(TAB_ALL)}
            style={[
              styles.tab,
              tab === TAB_ALL && {
                backgroundColor: theme.primaryLight,
                borderColor: theme.primary,
              },
            ]}>
            <ThemedText
              style={[
                styles.tabLabel,
                tab === TAB_ALL && { color: theme.primary },
              ]}>
              {t('chat.reactionsAll')}
            </ThemedText>
          </Pressable>
          {REACTION_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji.code}
              onPress={() => setTab(emoji.code)}
              style={[
                styles.tab,
                tab === emoji.code && {
                  backgroundColor: theme.primaryLight,
                  borderColor: theme.primary,
                },
              ]}>
              <Text
                style={[
                  styles.tabEmoji,
                  tab === emoji.code && { backgroundColor: theme.primary },
                ]}>
                {emoji.char}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>
          {tab === TAB_ALL ? (
            byUser.length === 0 ? (
              <ThemedText
                themeColor="textSecondary"
                style={styles.empty}>
                {t('chat.reactionsEmpty')}
              </ThemedText>
            ) : (
              byUser.map((row) => {
                const isMine = row.user_id === myUserId;
                return (
                  <View key={row.user_id} style={styles.userRow}>
                    {renderAvatar(row.user_id)}
                    <View style={styles.userMid}>
                      {renderName(row.user_id)}
                      <View style={styles.itemsRow}>
                        {row.items.map((it) => (
                          <View key={it.key} style={styles.item}>
                            <Text style={styles.itemEmoji}>{it.char}</Text>
                            {it.count > 1 && (
                              <ThemedText
                                themeColor="textSecondary"
                                style={styles.itemCount}>
                                {it.count}
                              </ThemedText>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                    {isMine && onRemoveMine && (
                      <Pressable
                        hitSlop={8}
                        accessibilityLabel={t('chat.removeReaction')}
                        onPress={() =>
                          onRemoveMine(row.items.map((i) => i.key))
                        }
                        style={styles.removeBtn}>
                        <Icon name="close" size={18} color={theme.textSecondary} />
                      </Pressable>
                    )}
                  </View>
                );
              })
            )
          ) : !tabGroup || tabGroup.user_ids.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {t('chat.reactionsEmpty')}
            </ThemedText>
          ) : (
            tabGroup.user_ids.map((uid) => (
              <View key={uid} style={styles.userRow}>
                {renderAvatar(uid)}
                {renderName(uid)}
              </View>
            ))
          )}
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
    maxHeight: '75%',
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
    paddingBottom: Spacing.xs,
  },
  title: {
    ...Typography.h2,
    fontSize: 18,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
  },
  pickerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerEmoji: {
    fontSize: 22,
    lineHeight: 24,
  },
  tabs: {
    flexGrow: 0,
    marginBottom: Spacing.xs,
  },
  tabsContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabLabel: {
    ...Typography.caption,
    fontWeight: '600',
  },
  tabEmoji: {
    fontSize: 16,
    lineHeight: 18,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: 2,
  },
  empty: {
    ...Typography.body,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 7,
  },
  userMid: {
    flex: 1,
    gap: 2,
  },
  itemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  itemEmoji: {
    fontSize: 14,
    lineHeight: 16,
  },
  itemCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  removeBtn: {
    padding: 4,
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
