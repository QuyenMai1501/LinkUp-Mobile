import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ChatBubble } from '@/components/chat/chat-bubble';
import { ChatComposer } from '@/components/chat/chat-composer';
import { MessageActions } from '@/components/chat/message-actions';
import { MediaLightbox } from '@/components/chat/media-lightbox';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/auth-context';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useChatRoom } from '@/hooks/useChatRoom';
import { useChatE2E } from '@/hooks/useChatE2E';
import { listChats, deleteChat, uploadChatMedia } from '@/api/chat';
import { Spacing, Typography } from '@/constants/theme';
import { formatChatDate } from '@/utils/chat';
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
  const [showDeleteChat, setShowDeleteChat] = useState(false);
  const [lightbox, setLightbox] = useState<{ msgs: ChatMessage[]; index: number } | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchInput, setSearchInput] = useState('');

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
    async (text: string, attachments?: { uri: string; name: string; type: string }[]) => {
      if (attachments && attachments.length > 0 && chatId) {
        // Upload and send attachments
        for (const att of attachments) {
          try {
            const res = await uploadChatMedia(att, chatId);
            room.sendMessage(text, {
              mediaId: res.data.id,
              mediaUri: res.data.file_uri,
              mediaType: res.data.file_type,
              replyToMessageId: replyingTo?.id,
            });
          } catch {
            // Failed to upload, skip
          }
        }
        setReplyingTo(null);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return;
      }

      // Text-only message
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
    [room, encryption, replyingTo, chatId],
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

  const handleMediaPress = useCallback((msg: ChatMessage) => {
    // Find all media messages in sequence for lightbox navigation
    const mediaMsgs = room.messages.filter(
      (m) => !m.deleted && !m.decrypt_failed && (m.media_id || m.media_uri),
    );
    const idx = mediaMsgs.findIndex((m) => m.id === msg.id);
    setLightbox({ msgs: mediaMsgs, index: idx >= 0 ? idx : 0 });
  }, [room.messages]);

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

  const handleDeleteChat = useCallback(async () => {
    if (!chatId) return;
    try {
      await deleteChat(chatId);
      setShowDeleteChat(false);
      router.navigate('/(drawer)/messages');
    } catch {
      setShowDeleteChat(false);
    }
  }, [chatId, router]);

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

        <Pressable
          onPress={() => {
            setSearchActive((prev) => !prev);
            if (searchActive) {
              setSearchInput('');
              room.clearSearch();
            }
          }}
          hitSlop={8}
          style={[styles.headerAction, searchActive && { backgroundColor: theme.bgSecondary }]}>
          <ThemedText style={[styles.headerActionIcon, { color: searchActive ? theme.primary : theme.textSecondary }]}>🔍</ThemedText>
        </Pressable>

        <Pressable onPress={() => setShowDeleteChat(true)} hitSlop={8} style={styles.headerAction}>
          <ThemedText style={[styles.headerActionIcon, { color: theme.textSecondary }]}>🗑️</ThemedText>
        </Pressable>
      </View>

      {/* Search bar */}
      {searchActive && (
        <View style={[styles.searchBar, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.border }]}>
          <ThemedText style={styles.searchIcon}>🔍</ThemedText>
          <View style={styles.searchInputWrap}>
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={searchInput}
              onChangeText={(text) => {
                setSearchInput(text);
                if (text.trim()) {
                  room.searchMessages(text);
                } else {
                  room.clearSearch();
                }
              }}
              placeholder={t('chat.searchMessages')}
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            {searchInput.length > 0 && (
              <Pressable onPress={() => { setSearchInput(''); room.clearSearch(); }} hitSlop={8}>
                <ThemedText style={[styles.searchClear, { color: theme.textSecondary }]}>✕</ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Messages */}
      <View style={[styles.messagesWrap, { backgroundColor: theme.bg }]}>
        {room.searchResults ? (
          <View style={styles.searchResults}>
            <View style={[styles.searchResultsHeader, { borderBottomColor: theme.border }]}>
              <ThemedText style={[styles.searchResultsTitle, { color: theme.text }]}>
                {t('chat.searchResults', { keyword: room.searchKeyword })}
              </ThemedText>
              <Pressable onPress={() => { setSearchInput(''); room.clearSearch(); }} hitSlop={8}>
                <ThemedText style={[styles.searchClear, { color: theme.textSecondary }]}>✕</ThemedText>
              </Pressable>
            </View>
            {room.searchResults.length === 0 ? (
              <View style={styles.center}>
                <ThemedText themeColor="textSecondary">{t('chat.noResults')}</ThemedText>
              </View>
            ) : (
              <FlatList
                data={room.searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.searchResultItem, { borderBottomColor: theme.border }]}>
                    <ThemedText style={[styles.searchResultSender, { color: theme.primary }]}>
                      {item.sender_id === myUserId ? t('chat.you') : (item.sender_name || t('chat.unknown'))}
                    </ThemedText>
                    <ThemedText style={[styles.searchResultContent, { color: theme.text }]} numberOfLines={2}>
                      {item.deleted ? t('chat.messageDeleted') : item.content || t('chat.attachment')}
                    </ThemedText>
                  </View>
                )}
              />
            )}
          </View>
        ) : room.loading ? (
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
              const showDate =
                !prev ||
                formatChatDate(item.created_at, t) !==
                  formatChatDate(prev.created_at, t);
              const showTime =
                !prev ||
                prev.sender_id !== item.sender_id ||
                new Date(item.created_at).getTime() -
                  new Date(prev.created_at).getTime() >
                  60000;
              return (
                <>
                  {showDate && (
                    <View style={styles.dateSep}>
                      <View style={[styles.dateSepLine, { backgroundColor: theme.border }]} />
                      <ThemedText style={[styles.dateSepText, { color: theme.textSecondary }]}>
                        {formatChatDate(item.created_at, t)}
                      </ThemedText>
                      <View style={[styles.dateSepLine, { backgroundColor: theme.border }]} />
                    </View>
                  )}
                  <ChatBubble
                    message={item}
                    isMine={item.sender_id === myUserId}
                    showTime={showTime}
                    onLongPress={handleLongPress}
                    onReplyPress={handleReplyPress}
                    onMediaPress={handleMediaPress}
                  />
                </>
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

      {/* Delete conversation confirmation */}
      {showDeleteChat && (
        <View style={styles.deleteOverlay}>
          <Pressable style={styles.deleteOverlayBg} onPress={() => setShowDeleteChat(false)} />
          <View style={[styles.deleteDialog, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.deleteTitle, { color: theme.text }]}>{t('chat.deleteChat')}</ThemedText>
            <ThemedText style={[styles.deleteDesc, { color: theme.textSecondary }]}>{t('chat.deleteChatConfirm')}</ThemedText>
            <View style={styles.deleteActions}>
              <Pressable
                style={[styles.deleteBtn, { backgroundColor: theme.bgSecondary }]}
                onPress={() => setShowDeleteChat(false)}>
                <ThemedText style={[styles.deleteBtnText, { color: theme.text }]}>{t('common.cancel')}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.deleteBtn, { backgroundColor: theme.danger }]}
                onPress={handleDeleteChat}>
                <ThemedText style={[styles.deleteBtnText, { color: '#FFF' }]}>{t('chat.delete')}</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Delete message confirmation */}
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
      {/* Media lightbox */}
      {lightbox && (
        <MediaLightbox
          visible={true}
          messages={lightbox.msgs}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
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
  headerAction: {
    padding: Spacing.xs,
  },
  headerActionIcon: {
    fontSize: 18,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 14,
  },
  searchClear: {
    fontSize: 14,
    padding: Spacing.xs,
  },
  searchResults: {
    flex: 1,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchResultsTitle: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 13,
  },
  searchResultItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  searchResultSender: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchResultContent: {
    ...Typography.body,
    fontSize: 14,
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
  dateSep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  dateSepLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dateSepText: {
    ...Typography.caption,
    fontSize: 12,
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
