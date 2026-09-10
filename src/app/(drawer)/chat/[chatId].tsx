import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChatBubble } from '@/components/chat/chat-bubble';
import { ChatComposer } from '@/components/chat/chat-composer';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/auth-context';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useChatRoom } from '@/hooks/useChatRoom';
import { useChatE2E } from '@/hooks/useChatE2E';
import { listChats } from '@/api/chat';
import { Spacing, Typography } from '@/constants/theme';
import type { ChatConversation, ChatMessage } from '@/types/chat';

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const socket = useChatSocket();
  const myUserId = user?.id ?? '';

  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Load conversation info
  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    listChats()
      .then((res) => {
        if (cancelled) return;
        const conv = res.data.find((c) => c.chat_id === chatId);
        if (conv) setConversation(conv);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chatId]);

  const partnerUserId = conversation?.partner.user_id ?? null;

  const encryption = useChatE2E({
    chatId: chatId ?? null,
    partnerUserId,
    myUserId,
  });

  const room = useChatRoom({
    chatId: chatId ?? null,
    myUserId,
    socket,
  });

  const handleSend = useCallback(
    async (text: string) => {
      let content = text;
      try {
        if (encryption.ready) {
          content = await encryption.encrypt(text);
        }
      } catch {
        // Send unencrypted if encryption fails
      }
      room.sendMessage(content);
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    [room, encryption],
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      room.sendTyping(isTyping);
    },
    [room],
  );

  const partner = conversation?.partner;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.bg }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <ThemedText style={styles.backIcon}>←</ThemedText>
        </Pressable>

        {partner?.avatar_uri ? (
          <Image source={{ uri: partner.avatar_uri }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.primaryLight }]}>
            <ThemedText style={[styles.avatarLetter, { color: theme.primary }]}>
              {(partner?.display_name || '?')[0]?.toUpperCase()}
            </ThemedText>
          </View>
        )}

        <View style={styles.headerMeta}>
          <ThemedText style={styles.headerName} numberOfLines={1}>
            {partner?.display_name || t('chat.unknown')}
          </ThemedText>
          {encryption.ready && (
            <ThemedText style={styles.e2eBadge}>🔒 {t('chat.e2eBadge')}</ThemedText>
          )}
        </View>
      </View>

      {/* Messages */}
      <View style={[styles.messagesWrap, { backgroundColor: theme.bg }]}>
        {room.loading ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
          </View>
        ) : room.messages.length === 0 ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">{t('chat.noMessages')}</ThemedText>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={room.messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const prev = room.messages[index - 1];
              const showTime =
                !prev ||
                prev.sender_id !== item.sender_id ||
                new Date(item.created_at).getTime() -
                  new Date(prev.created_at).getTime() >
                  60000;
              return (
                <ChatBubble
                  message={item}
                  isMine={item.sender_id === myUserId}
                  showTime={showTime}
                />
              );
            }}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            contentContainerStyle={styles.messageList}
          />
        )}

        {room.partnerTyping && <TypingIndicator />}
      </View>

      {/* Composer */}
      <ChatComposer onSend={handleSend} onTyping={handleTyping} />
    </KeyboardAvoidingView>
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
    gap: Spacing.sm,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  backIcon: {
    fontSize: 22,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  headerMeta: {
    flex: 1,
    gap: 1,
  },
  headerName: {
    ...Typography.body,
    fontWeight: 600,
  },
  e2eBadge: {
    ...Typography.caption,
    fontSize: 10,
    opacity: 0.7,
  },
  messagesWrap: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingVertical: Spacing.sm,
  },
});
