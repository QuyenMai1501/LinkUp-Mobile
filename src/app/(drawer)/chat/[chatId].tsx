import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { Icon } from '@/components/ui/icon';
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
  const pinToBottomRef = useRef(true);
  const isNearBottomRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const prevMsgCountRef = useRef(0);

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
    encryption,
  });

  const handleSend = useCallback(
    async (text: string, attachments?: { uri: string; name: string; type: string }[], gifUrl?: string) => {
      // GIF từ GIPHY -> gửi ngay dưới dạng gif_url (server tạo media từ URL).
      if (gifUrl) {
        room.sendMessage('', { gifUrl, replyToMessageId: replyingTo?.id });
        setReplyingTo(null);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return;
      }

      if (attachments && attachments.length > 0 && chatId) {
        let caption = text;
        let captionEncrypted = false;
        try {
          if (encryption.ready && caption) {
            caption = await encryption.encrypt(caption);
            captionEncrypted = true;
          }
        } catch {
          // Send unencrypted if encryption fails
        }

        for (let i = 0; i < attachments.length; i++) {
          const att = attachments[i];
          try {
            const res = await uploadChatMedia(att, chatId);
            room.sendMessage(i === 0 ? caption : '', {
              mediaId: res.data.id,
              mediaUri: res.data.file_uri,
              mediaType: res.data.file_type,
              replyToMessageId: i === 0 ? replyingTo?.id : undefined,
              e2eEncrypted: i === 0 ? captionEncrypted : false,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            Alert.alert(t('common.error'), msg || t('chat.uploadFailed'));
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
      let encrypted = false;
      try {
        if (encryption.ready) {
          content = await encryption.encrypt(text);
          encrypted = true;
        }
      } catch {
        // Send unencrypted if encryption fails
      }
      room.sendMessage(content, {
        replyToMessageId: replyingTo?.id,
        e2eEncrypted: encrypted,
      });
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

  const handlePin = useCallback((msg: ChatMessage) => {
    room.pinMessage(msg.id);
  }, [room]);

  const handleUnpin = useCallback((msg: ChatMessage) => {
    room.unpinMessage(msg.id);
  }, [room]);

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

  const scrollToMessage = useCallback(
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

  // --- Infinite scroll: load more on scroll to top ---
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Bỏ qua scroll do programmatic gây ra (giống Web)
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        return;
      }

      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const atBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
      const atTop = contentOffset.y <= 48;

      if (atBottom) {
        pinToBottomRef.current = true;
        isNearBottomRef.current = true;
        setIsNearBottom(true);
        setNewMessagesCount(0);
      } else {
        pinToBottomRef.current = false;
        isNearBottomRef.current = false;
        setIsNearBottom(false);
      }

      if (atTop && room.hasMore && !room.loadingMore) {
        room.loadMoreMessages();
      }
    },
    [room.hasMore, room.loadingMore, room.loadMoreMessages],
  );

  const scrollToBottom = useCallback(() => {
    programmaticScrollRef.current = true;
    flatListRef.current?.scrollToEnd({ animated: true });
    pinToBottomRef.current = true;
    isNearBottomRef.current = true;
    setIsNearBottom(true);
    setNewMessagesCount(0);
  }, []);

  // Track new messages + auto-scroll (gộp lại giống Web)
  useEffect(() => {
    const count = room.messages.length;
    if (prevMsgCountRef.current > 0 && count > prevMsgCountRef.current && room.searchResults === null) {
      if (pinToBottomRef.current) {
        // Đang ở dưới → auto scroll xuống
        programmaticScrollRef.current = true;
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 50);
      } else {
        // Đang cuộn lên → đếm tin mới
        setNewMessagesCount((prev) => prev + (count - prevMsgCountRef.current));
      }
    }
    prevMsgCountRef.current = count;
  }, [room.messages.length]);

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
            <ThemedText style={styles.e2eBadge}>
            <Icon name="lock" size={12} /> {t('chat.e2eBadge')}
          </ThemedText>
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
          <Icon name="search" size={18} color={searchActive ? theme.primary : theme.textSecondary} />
        </Pressable>

        <Pressable onPress={() => setShowDeleteChat(true)} hitSlop={8} style={styles.headerAction}>
          <Icon name="trash" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      {/* Search bar */}
      {searchActive && (
        <View style={[styles.searchBar, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.border }]}>
          <Icon name="search" size={14} color={theme.textSecondary} />
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
                <Icon name="close" size={14} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Pinned messages bar */}
      {room.pinnedMessages.length > 0 && !searchActive && (
        <View style={[styles.pinnedBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <View style={styles.pinnedBarHeader}>
            <ThemedText style={[styles.pinnedBarTitle, { color: theme.primary }]}>
              <Icon name="pin" size={12} color={theme.primary} /> {t('chat.pinnedMessages')} ({room.pinnedMessages.length})
            </ThemedText>
          </View>
          {room.pinnedMessages.map((pin) => (
            <Pressable
              key={pin.message_id}
              style={[styles.pinnedBarItem, { backgroundColor: theme.bgSecondary }]}
              onPress={() => scrollToMessage(pin.message_id)}
            >
              <View style={styles.pinnedBarItemContent}>
                <ThemedText style={[styles.pinnedBarItemSender, { color: theme.text }]} numberOfLines={1}>
                  {pin.sender_name || t('chat.unknown')}
                </ThemedText>
                <ThemedText style={[styles.pinnedBarItemText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {pin.content.length > 60 ? pin.content.slice(0, 60) + '...' : pin.content || t('chat.attachment')}
                </ThemedText>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() => room.unpinMessage(pin.message_id)}
                style={styles.pinnedBarRemove}
              >
                <ThemedText style={{ color: theme.textSecondary, fontSize: 16 }}>×</ThemedText>
              </Pressable>
            </Pressable>
          ))}
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
                <Icon name="close" size={14} color={theme.textSecondary} />
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
          <>
            {room.hasMore && (
              <View style={styles.loadMoreRow}>
                {room.loadingMore ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <ThemedText themeColor="textSecondary" style={styles.loadMoreText}>
                    {t('chat.scrollForOlder')}
                  </ThemedText>
                )}
              </View>
            )}
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
                      isPinned={room.pinnedMessages.some((p) => p.message_id === item.id)}
                      onLongPress={handleLongPress}
                      onReplyPress={handleReplyPress}
                      onMediaPress={handleMediaPress}
                    />
                  </>
                );
              }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onContentSizeChange={() => {
                if (pinToBottomRef.current) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
              contentContainerStyle={styles.messageList}
            />
          </>
        )}

        {room.partnerTyping && <TypingIndicator />}
      </View>

      {/* New messages bar – like Web */}
      {newMessagesCount > 0 && !isNearBottom && (
        <Pressable
          style={[styles.newMessagesBar, { backgroundColor: theme.primary }]}
          onPress={scrollToBottom}
        >
          <ThemedText style={styles.newMessagesText}>
            ↓ {newMessagesCount} {t('chat.scrollToLower')}
          </ThemedText>
        </Pressable>
      )}

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
        isPinned={actionTarget ? room.pinnedMessages.some((p) => p.message_id === actionTarget.id) : false}
        canPin={room.pinnedMessages.length < 2}
        onClose={() => setActionTarget(null)}
        onReply={handleReply}
        onDelete={handleDeleteRequest}
        onPin={handlePin}
        onUnpin={handleUnpin}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
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
  loadMoreRow: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  loadMoreText: {
    fontSize: 12,
    opacity: 0.6,
  },
  pinnedBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinnedBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  pinnedBarTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  pinnedBarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    padding: 6,
    borderRadius: 6,
  },
  pinnedBarItemContent: {
    flex: 1,
    minWidth: 0,
  },
  pinnedBarItemSender: {
    fontSize: 12,
    fontWeight: '600',
  },
  pinnedBarItemText: {
    fontSize: 12,
  },
  pinnedBarRemove: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newMessagesBar: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 6,
    marginHorizontal: Spacing.md,
    marginBottom: -4,
    borderRadius: 20,
  },
  newMessagesText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
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
