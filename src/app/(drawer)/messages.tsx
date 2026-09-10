import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDrawerStatus } from '@react-navigation/drawer';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ConversationListItem } from '@/components/chat/conversation-list-item';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/auth-context';
import { useChatSocket } from '@/hooks/useChatSocket';
import { listChats } from '@/api/chat';
import { Spacing, Typography } from '@/constants/theme';
import type { ChatConversation } from '@/types/chat';

export default function MessagesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const socket = useChatSocket();
  const myUserId = user?.id ?? '';

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

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

  const handleSelect = useCallback(
    (conv: ChatConversation) => {
      (router as any).push(`/(drawer)/chat/${conv.chat_id}`);
    },
    [router],
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.menuBtn}>
          <ThemedText style={styles.menuIcon}>☰</ThemedText>
        </Pressable>
        <ThemedText style={styles.title}>{t('chat.title')}</ThemedText>
        <View style={styles.headerSpacer} />
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  menuBtn: {
    padding: Spacing.xs,
  },
  menuIcon: {
    fontSize: 22,
  },
  title: {
    ...Typography.h2,
    flex: 1,
  },
  headerSpacer: {
    width: 32,
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
