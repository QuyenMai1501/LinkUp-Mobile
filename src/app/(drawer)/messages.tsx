import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ConversationListItem } from '@/components/chat/conversation-list-item';
import { UserPickerModal } from '@/components/chat/user-picker-modal';
import { Colors } from '@/constants/colors';
import { useThemeMode } from '@/contexts/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/auth-context';
import { useChatSocket } from '@/hooks/useChatSocket';
import { listChats, createDirectChat } from '@/api/chat';
import { Spacing, Typography } from '@/constants/theme';
import type { ChatConversation } from '@/types/chat';

export default function MessagesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const { user } = useAuth();
  const socket = useChatSocket();
  const myUserId = user?.id ?? '';

  const openDrawer = () => {
    (navigation as any).openDrawer?.();
  };

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load conversations
  useEffect(() => {
    let cancelled = false;
    listChats()
      .then((res) => {
        if (!cancelled) setConversations(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Listen for presence updates via socket
  useEffect(() => {
    const unsub = socket.subscribe('presence:update', (payload: any) => {
      if (payload.user_id && payload.is_online !== undefined) {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (payload.is_online) next.add(payload.user_id);
          else next.delete(payload.user_id);
          return next;
        });
      }
    });
    return unsub;
  }, [socket]);

  const filtered = filter.trim()
    ? conversations.filter((c) =>
        c.partner.display_name.toLowerCase().includes(filter.toLowerCase()),
      )
    : conversations;

  const refreshList = useCallback(() => {
    listChats()
      .then((res) => setConversations(res.data))
      .catch(() => {});
  }, []);

  const handlePickUser = useCallback(
    async (user: { user_id: string }) => {
      setPickerOpen(false);
      try {
        const res = await createDirectChat(user.user_id);
        refreshList();
        (router as any).push(`/(drawer)/chat/${res.chat_id}`);
      } catch {
        // silent — chat may already exist
      }
    },
    [router, refreshList],
  );

  const handleSelect = useCallback(
    (conv: ChatConversation) => {
      (router as any).push(`/(drawer)/chat/${conv.chat_id}`);
    },
    [router],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={openDrawer} style={styles.actionBtn}>
            <ThemedText style={[styles.actionIcon, { color: colors.text }]}>☰</ThemedText>
          </Pressable>
          <ThemedText style={[styles.title, { color: colors.text }]}>{t('chat.title')}</ThemedText>
          <Pressable onPress={() => setPickerOpen(true)} style={[styles.newChatBtn, { backgroundColor: colors.primary }]}>
            <ThemedText style={styles.newChatIcon}>+</ThemedText>
          </Pressable>
        </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: theme.bgSecondary }]}>
        <ThemedText style={styles.searchIcon}>🔍</ThemedText>
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          value={filter}
          onChangeText={setFilter}
          placeholder={t('chat.searchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
        />
        {filter.length > 0 && (
          <Pressable onPress={() => setFilter('')} hitSlop={8}>
            <ThemedText style={styles.clearIcon}>✕</ThemedText>
          </Pressable>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>💬</ThemedText>
          <ThemedText themeColor="textSecondary">
            {filter ? t('chat.noResults') : t('chat.noConversations')}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.chat_id}
          renderItem={({ item }) => (
            <ConversationListItem
              conversation={item}
              myUserId={myUserId}
              isOnline={onlineUsers.has(item.partner.user_id)}
              isActive={false}
              onPress={() => handleSelect(item)}
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
          )}
        />
      )}
      </SafeAreaView>

      <UserPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickUser}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
  },
  title: {
    ...Typography.h2,
    flex: 1,
  },
  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatIcon: {
    fontSize: 20,
    color: '#FFF',
    fontWeight: '600',
    lineHeight: 22,
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
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  clearIcon: {
    fontSize: 14,
    opacity: 0.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
});
