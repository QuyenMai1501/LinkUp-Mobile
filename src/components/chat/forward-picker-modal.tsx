import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { listChats } from '@/api/chat';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatConversation } from '@/types/chat';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Không liệt kê chat hiện tại — tránh tự chuyển tiếp về chính nó. */
  excludeChatId?: string;
  onPick: (chatId: string) => void;
}

/**
 * B1: chọn hội thoại đích khi chuyển tiếp tin nhắn — liệt kê direct chats
 * (mobile chưa có group chat), lọc client-side theo tên đối phương.
 */
export function ForwardPickerModal({ visible, onClose, excludeChatId, onPick }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setKeyword('');
      setConversations([]);
      setLoading(true);
      listChats()
        .then((res) =>
          setConversations(res.data.filter((c) => c.chat_id !== excludeChatId)),
        )
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    prevVisibleRef.current = visible;
  }, [visible, excludeChatId]);

  const filtered = keyword.trim()
    ? conversations.filter((c) =>
        c.partner.display_name
          .toLowerCase()
          .includes(keyword.trim().toLowerCase()),
      )
    : conversations;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.cancelBtn}>
            <ThemedText style={[styles.cancelText, { color: theme.primary }]}>
              {t('common.cancel')}
            </ThemedText>
          </Pressable>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            {t('chat.forward')}
          </ThemedText>
          <View style={styles.cancelBtn} />
        </View>

        <View style={[styles.searchWrap, { backgroundColor: theme.bgSecondary }]}>
          <Icon name="search" size={14} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={keyword}
            onChangeText={setKeyword}
            placeholder={t('chat.searchPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoFocus
          />
          {keyword.length > 0 && (
            <Pressable onPress={() => setKeyword('')} hitSlop={8}>
              <Icon name="close" size={14} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">{t('chat.noConversations')}</ThemedText>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.chat_id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? theme.bgSecondary : 'transparent' },
                ]}
                onPress={() => onPick(item.chat_id)}>
                {item.partner.avatar_uri ? (
                  <Image
                    source={{ uri: item.partner.avatar_uri }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarPlaceholder,
                      { backgroundColor: theme.primaryLight },
                    ]}>
                    <ThemedText style={[styles.avatarLetter, { color: theme.primary }]}>
                      {(item.partner.display_name || '?')[0]?.toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.partner.display_name}
                </ThemedText>
                <Icon name="share" size={16} color={theme.primary} />
              </Pressable>
            )}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.border }]} />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    ...Typography.body,
    fontSize: 15,
  },
  title: {
    ...Typography.h2,
    fontSize: 17,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    ...Typography.body,
    fontWeight: 600,
    fontSize: 16,
  },
  name: {
    ...Typography.body,
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
});
