import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ChatBubble } from '@/components/chat/chat-bubble';
import { ChatComposer } from '@/components/chat/chat-composer';
import { MessageActions } from '@/components/chat/message-actions';
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

  // Message actions state
  const [actionTarget, setActionTarget] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);

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
      room.sendMessage(content, { replyToMessageId: replyingTo?.id });
      setReplyingTo(null);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    [room, encryption, replyingTo],
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      room.sendTyping(isTyping);
    },
    [room],
  );

  const handleLongPress = useCallback((msg: ChatMessage) => {
    setActionTarget(msg);
  }, []);

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyingTo(msg);
  }, []);

  const handleDeleteRequest = useCallback((msg: ChatMessage) => {
    setDeleteTarget(msg);
  }, []);

  const handleConfirmDelete = useCallback(
    (mode: 'all' | 'me') => {
      if (deleteTarget) {
        room.deleteMessage(deleteTarget.id, mode);
      }
      setDeleteTarget(null);
    },
    [deleteTarget, room],
  );

  const handleReplyPress = useCallback(
    (messageId: string) => {
      const idx = room.messages.findIndex((m) => m.id === messageId);
      if (idx >= 0) {
        (flatListRef.current as any)?.scrollToIndex?.({ index: idx, animated: true, viewPosition: 0.3 });
      }
    },
    [room.messages],
  );

  const partner = conversation?.partner;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.bg }]}>
        <Pressable onPress={() => router.navigate('/(drawer)/messages')} hitSlop={8} style={styles.backBtn}>
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
                  onLongPress={handleLongPress}
                  onReplyPress={handleReplyPress}
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
      <ChatComposer
        onSend={handleSend}
        onTyping={handleTyping}
        replyingTo={replyingTo}
        onClearReply={() => setReplyingTo(null)}
      />
      </KeyboardAvoidingView>

      {/* Message actions menu */}
      <MessageActions
        message={actionTarget}
        myUserId={myUserId}
        onClose={() => setActionTarget(null)}
        onReply={handleReply}
        onDelete={handleDeleteRequest}
      />

      {/* Delete confirmation */}
      {deleteTarget && (
        <View style={styles.deleteOverlay}>
          <Pressable style={styles.deleteOverlayBg} onPress={() => setDeleteTarget(null)} />
          <View style={[styles.deleteDialog, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.deleteTitle, { color: theme.text }]}>{t('chat.deleteMessage')}</ThemedText>
            <ThemedText style={[styles.deleteDesc, { color: theme.textSecondary }]}>{t('chat.deleteConfirm')}</ThemedText>
            <View style={styles.deleteActions}>
              <Pressable
                style={[styles.deleteBtn, { backgroundColor: theme.bgSecondary }]}
                onPress={() => handleConfirmDelete('me')}>
                <ThemedText style={[styles.deleteBtnText, { color: theme.text }]}>{t('chat.deleteForMe')}</ThemedText>
              </Pressable>
              {deleteTarget.sender_id === myUserId && (
                <Pressable
                  style={[styles.deleteBtn, { backgroundColor: theme.danger }]}
                  onPress={() => handleConfirmDelete('all')}>
                  <ThemedText style={[styles.deleteBtnText, { color: '#FFF' }]}>{t('chat.deleteForAll')}</ThemedText>
                </Pressable>
              )}
            </View>
            <Pressable style={styles.deleteCancel} onPress={() => setDeleteTarget(null)}>
              <ThemedText style={[styles.deleteCancelText, { color: theme.textSecondary }]}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
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
  // Delete confirmation dialog
  deleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteOverlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  deleteDialog: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    zIndex: 101,
  },
  deleteTitle: {
    ...Typography.h2,
    fontSize: 17,
  },
  deleteDesc: {
    ...Typography.body,
    fontSize: 14,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  deleteBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  deleteCancel: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: Spacing.xs,
  },
  deleteCancelText: {
    fontSize: 14,
  },
});
