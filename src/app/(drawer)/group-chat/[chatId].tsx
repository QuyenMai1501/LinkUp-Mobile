import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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

import {
  getGroupChatBackground,
  getGroupSettings,
  type GroupChatBackground,
} from '@/api/group-chat';
import { uploadChatMedia } from '@/api/chat';
import { ChatBubble } from '@/components/chat/chat-bubble';
import { ChatComposer } from '@/components/chat/chat-composer';
import { parseGradientColors } from '@/components/chat/chat-background-picker';
import { ForwardPickerModal } from '@/components/chat/forward-picker-modal';
import { MediaLightbox } from '@/components/chat/media-lightbox';
import { MediaStack } from '@/components/chat/media-stack';
import { MessageActions } from '@/components/chat/message-actions';
import {
  SystemMessage,
  isSystemMessage,
} from '@/components/chat/system-message';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { GroupCallHistoryBubble } from '@/components/calls/group-call-history-bubble';
import { GroupCallMemberSelectModal } from '@/components/calls/group-call-member-select-modal';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useGroupCall } from '@/contexts/group-call-context';
import { useTheme } from '@/hooks/use-theme';
import { useGroupChatRoom } from '@/hooks/useGroupChatRoom';
import { useGroupChatSocket } from '@/hooks/useGroupChatSocket';
import { useServerEmojis } from '@/hooks/use-server-emojis';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage, ReplyPreview } from '@/types/chat';
import type { GroupCallHistoryItem } from '@/types/group-call';
import type { GroupChatConversation } from '@/types/group-chat';
import { formatChatDate } from '@/utils/chat';
import {
  groupMediaTimeline,
  type MediaGroupItem,
} from '@/utils/chatMediaGroup';
import { stashForwardDraft, takeForwardDraft } from '@/utils/forward-draft';

/** Item lịch sử cuộc gọi nhóm — xen vào timeline theo created_at. */
interface GroupCallTimelineItem {
  kind: 'group_call';
  call: GroupCallHistoryItem;
}

type GroupedItem = ChatMessage | MediaGroupItem | GroupCallTimelineItem;

/** created timestamp ms của mọi kind item trong timeline. */
function itemCreatedMs(item: GroupedItem): number {
  if ('kind' in item) {
    if (item.kind === 'group_call') {
      return new Date(item.call.created_at).getTime();
    }
    return new Date(item.msgs[0]?.created_at ?? 0).getTime();
  }
  return new Date(item.created_at).getTime();
}

/** Prev item cho date-separator/showTime: group media → tin cuối. */
function resolvePrevMsg(
  items: GroupedItem[],
  index: number,
): { createdAt: string; senderId: string } | undefined {
  const prev = items[index - 1];
  if (!prev) return undefined;
  if ('kind' in prev) {
    if (prev.kind === 'group_call') {
      return { createdAt: prev.call.created_at, senderId: prev.call.caller_id };
    }
    const last = prev.msgs[prev.msgs.length - 1];
    return last
      ? { createdAt: last.created_at, senderId: last.sender_id }
      : undefined;
  }
  return { createdAt: prev.created_at, senderId: prev.sender_id };
}

// Job upload media local — giữ file để retry nếu upload thất bại.
type UploadJob = {
  file: { uri: string; name: string; type: string };
  durationSeconds?: number;
  caption?: string;
  replyToMessageId?: string;
};

function buildReplyPreview(m: ChatMessage, senderLabel: string): ReplyPreview {
  return {
    id: m.id,
    content: m.content ?? '',
    sender_id: m.sender_id,
    sender_name: senderLabel,
    sender_avatar: m.sender_avatar ?? '',
    decrypted: true,
  };
}

export default function GroupChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const socket = useGroupChatSocket();
  const myUserId = user?.id ?? '';
  const { isInGroupCall, startGroupCall, call: activeCall, joinGroupCall } =
    useGroupCall();

  // C2: modal chọn thành viên gọi nhóm.
  const [callModalOpen, setCallModalOpen] = useState(false);

  const [group, setGroup] = useState<GroupChatConversation | null>(null);
  // P3b: nền trò chuyện per-group (solid/gradient/custom image).
  const [chatBackground, setChatBackground] =
    useState<GroupChatBackground | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollFailCountRef = useRef(0);

  const [actionTarget, setActionTarget] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  // Draft chuyển tiếp (rút từ forward-draft store — navigate sang instance mới).
  const [forwardDraft, setForwardDraft] = useState<{
    messageId: string;
    content: string;
    emojiId?: string;
  } | null>(null);
  const [forwardPickerFor, setForwardPickerFor] = useState<ChatMessage | null>(
    null,
  );
  const [lightbox, setLightbox] = useState<{
    msgs: ChatMessage[];
    index: number;
  } | null>(null);
  // Tìm kiếm tin nhắn trong nhóm + highlight khi nhảy từ kết quả.
  const [searchActive, setSearchActive] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  const pinToBottomRef = useRef(true);
  const isNearBottomRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const prevMsgCountRef = useRef(0);

  // Load thông tin nhóm (tên, avatar, số thành viên). Dùng useFocusEffect để
  // reload khi quay về từ màn settings (HTTP rename không broadcast WS).
  useFocusEffect(
    useCallback(() => {
      if (!chatId) return;
      let cancelled = false;
      getGroupSettings(chatId)
        .then((res) => {
          if (cancelled) return;
          const s = res.data;
          setGroup({
            chat_id: s.chat_id,
            name: s.name,
            avatar_uri: s.avatar_uri,
            member_count: s.members?.length ?? 0,
            updated_at: new Date().toISOString(),
          });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [chatId]),
  );

  // Realtime: nhóm đổi tên/ảnh → cập nhật header ngay.
  useEffect(() => {
    const unsub = socket.subscribe('group:settings:updated', (payload: any) => {
      if (payload.chat_id !== chatId) return;
      setGroup((prev) =>
        prev
          ? {
              ...prev,
              name: payload.name ?? prev.name,
              avatar_uri: payload.avatar_uri ?? prev.avatar_uri,
            }
          : prev,
      );
    });
    return unsub;
  }, [socket, chatId]);

  // Rút draft chuyển tiếp khi mount / đổi chat (null nếu không có).
  // setState sau await — tránh react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const taken = takeForwardDraft(chatId ?? '');
      setForwardDraft(
        taken
          ? {
              messageId: taken.messageId,
              content: taken.content,
              emojiId: taken.emojiId,
            }
          : null,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // Tự tắt highlight nhảy tới tin từ kết quả tìm kiếm.
  useEffect(() => {
    if (!flashId) return;
    const timer = setTimeout(() => setFlashId(null), 1600);
    return () => clearTimeout(timer);
  }, [flashId]);

  // P3b: load nền — refetch khi quay lại màn (user đổi nền ở settings).
  useFocusEffect(
    useCallback(() => {
      if (!chatId) return;
      let cancelled = false;
      getGroupChatBackground(chatId)
        .then((res) => {
          if (cancelled) return;
          const bg = res.data;
          setChatBackground(bg?.type ? bg : null);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [chatId]),
  );

  const room = useGroupChatRoom({
    chatId: chatId ?? null,
    myUserId,
    socket,
  });

  const { byId: serverEmojis } = useServerEmojis();

  const timeline = useMemo<GroupedItem[]>(() => {
    const msgItems = groupMediaTimeline(room.messages);
    if (room.callHistory.length === 0) return msgItems;
    // Xen call-history bubbles vào timeline theo created_at (mirror Web useChatTimeline).
    const merged: GroupedItem[] = [
      ...msgItems,
      ...room.callHistory.map<GroupCallTimelineItem>((call) => ({
        kind: 'group_call',
        call,
      })),
    ];
    return merged.sort((a, b) => itemCreatedMs(a) - itemCreatedMs(b));
  }, [room.messages, room.callHistory]);

  // call_id của cuộc gọi nhóm đang diễn ra — nút Yêu cầu tham gia trên history bubble.
  const activeGroupCallId =
    activeCall && isInGroupCall ? activeCall.callId : null;

  const findIndexInGrouped = useCallback(
    (messageId: string): number => {
      for (let i = 0; i < timeline.length; i++) {
        const item = timeline[i];
        if ('kind' in item) {
          if (item.kind === 'group_call') continue;
          if (item.msgs.some((m) => m.id === messageId)) return i;
        } else if (item.id === messageId) {
          return i;
        }
      }
      return -1;
    },
    [timeline],
  );

  const senderLabel = useCallback(
    (msg: ChatMessage): string => {
      if (msg.sender_id === myUserId) return t('chat.you');
      return (
        msg.sender_name ||
        room.memberNames[msg.sender_id] ||
        t('chat.unknown')
      );
    },
    [myUserId, room.memberNames, t],
  );

  const replySenderLabel = replyingTo ? senderLabel(replyingTo) : undefined;

  const uploadJobsRef = useRef<Map<string, UploadJob>>(new Map());

  const runUpload = useCallback(
    async (tempId: string, job: UploadJob): Promise<void> => {
      if (!chatId) return;
      try {
        const res = await uploadChatMedia(job.file, chatId, job.durationSeconds);
        if (!uploadJobsRef.current.has(tempId)) return; // đã bị bỏ
        uploadJobsRef.current.delete(tempId);
        await room.completeMediaUpload(
          tempId,
          {
            mediaId: res.data.id,
            mediaUri: res.data.file_uri,
            mediaType: res.data.file_type,
            durationSeconds: res.data.duration_seconds ?? job.durationSeconds,
          },
          { content: job.caption, replyToMessageId: job.replyToMessageId },
        );
      } catch (err) {
        if (!uploadJobsRef.current.has(tempId)) return;
        room.failUpload(tempId);
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert(t('common.error'), msg || t('chat.uploadFailed'));
      }
    },
    [chatId, room, t],
  );

  const handleSend = useCallback(
    async (
      text: string,
      attachments?: { uri: string; name: string; type: string }[],
      gifUrl?: string,
    ) => {
      // GIF từ GIPHY → gửi ngay dưới dạng gif_url.
      if (gifUrl) {
        setForwardDraft(null); // gif + forward không gửi cùng — bỏ draft
        room.sendMessage('', { gifUrl, replyToMessageId: replyingTo?.id });
        setReplyingTo(null);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return;
      }

      if (attachments && attachments.length > 0 && chatId) {
        setForwardDraft(null); // đính kèm + forward không gửi cùng — bỏ draft
        const caption = text;
        for (let i = 0; i < attachments.length; i++) {
          const att = attachments[i];
          const isFirst = i === 0;
          const tempId = room.beginMediaUpload({
            localUri: att.uri,
            mediaType: att.type,
            content: isFirst ? caption : '',
            replyTo:
              isFirst && replyingTo && replySenderLabel
                ? buildReplyPreview(replyingTo, replySenderLabel)
                : null,
            replyToMessageId: isFirst ? replyingTo?.id : undefined,
          });
          if (!tempId) continue;
          const job: UploadJob = {
            file: att,
            caption: isFirst ? caption : '',
            replyToMessageId: isFirst ? replyingTo?.id : undefined,
          };
          uploadJobsRef.current.set(tempId, job);
          // Upload tuần tự — thứ tự bubble = thứ tự wire/echo.
          await runUpload(tempId, job);
        }
        setReplyingTo(null);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return;
      }

      // Group chat KHÔNG có E2E — gửi plaintext (server mã AES phía server).
      // Sticker-forward gửi đúng emoji_id gốc (content rỗng).
      room.sendMessage(text, {
        replyToMessageId: replyingTo?.id,
        forwardedFrom: forwardDraft?.messageId,
        emojiId: forwardDraft?.emojiId,
      });
      setReplyingTo(null);
      setForwardDraft(null);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    [room, replyingTo, replySenderLabel, forwardDraft, chatId, runUpload],
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      room.sendTyping(isTyping);
    },
    [room],
  );

  const handleSendVoice = useCallback(
    (
      file: { uri: string; name: string; type: string },
      durationSec: number,
    ) => {
      if (!chatId) return;
      setForwardDraft(null); // thoại + forward không gửi cùng — bỏ draft
      const tempId = room.beginMediaUpload({
        localUri: file.uri,
        mediaType: file.type,
        durationSeconds: durationSec,
        replyTo:
          replyingTo && replySenderLabel
            ? buildReplyPreview(replyingTo, replySenderLabel)
            : null,
        replyToMessageId: replyingTo?.id,
      });
      if (!tempId) return;
      const job: UploadJob = {
        file,
        durationSeconds: durationSec,
        replyToMessageId: replyingTo?.id,
      };
      uploadJobsRef.current.set(tempId, job);
      setReplyingTo(null);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      void runUpload(tempId, job);
    },
    [chatId, room, replyingTo, replySenderLabel, runUpload],
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

  const handleReact = useCallback(
    (messageId: string, emojiId: string) => {
      room.reactToMessage(messageId, emojiId);
    },
    [room],
  );

  // Mở picker chọn hội thoại đích (direct hoặc group).
  const handleForward = useCallback((msg: ChatMessage) => {
    setForwardPickerFor(msg);
  }, []);

  const handleForwardPick = useCallback(
    (target: { chatId: string; type: 'direct' | 'group' }) => {
      const msg = forwardPickerFor;
      setForwardPickerFor(null);
      if (!msg) return;
      stashForwardDraft({
        chatId: target.chatId,
        messageId: msg.id,
        content: msg.deleted ? '' : (msg.content ?? ''),
        emojiId: msg.emoji_id ?? undefined,
      });
      const route =
        target.type === 'group'
          ? `/(drawer)/group-chat/${target.chatId}`
          : `/(drawer)/chat/${target.chatId}`;
      (router as any).push(route);
    },
    [forwardPickerFor, router],
  );

  const handleRetry = useCallback(
    (msg: ChatMessage) => {
      const job = uploadJobsRef.current.get(msg.id);
      if (job) {
        room.markSending(msg.id);
        void runUpload(msg.id, job);
        return;
      }
      room.retryMessage(msg.id);
    },
    [room, runUpload],
  );

  const handleDiscard = useCallback(
    (msg: ChatMessage) => {
      uploadJobsRef.current.delete(msg.id);
      room.discardMessage(msg.id);
    },
    [room],
  );

  const handleMediaPress = useCallback(
    (msg: ChatMessage) => {
      const mediaMsgs = room.messages.filter(
        (m) =>
          !m.deleted &&
          (m.media_id || m.media_uri) &&
          !m.media_type?.startsWith('audio/'),
      );
      const idx = mediaMsgs.findIndex((m) => m.id === msg.id);
      setLightbox({ msgs: mediaMsgs, index: idx >= 0 ? idx : 0 });
    },
    [room.messages],
  );

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
      const idx = findIndexInGrouped(messageId);
      if (idx >= 0) {
        scrollFailCountRef.current = 0;
        (flatListRef.current as any)?.scrollToIndex?.({
          index: idx,
          animated: true,
          viewPosition: 0.3,
        });
      }
    },
    [findIndexInGrouped],
  );

  // Nhảy tới tin (từ kết quả search / pinned bar).
  const scrollToMessage = useCallback(
    (messageId: string) => {
      const idx = findIndexInGrouped(messageId);
      if (idx >= 0) {
        scrollFailCountRef.current = 0;
        (flatListRef.current as any)?.scrollToIndex?.({
          index: idx,
          animated: true,
          viewPosition: 0.3,
        });
      }
    },
    [findIndexInGrouped],
  );

  const handlePin = useCallback(
    (msg: ChatMessage) => {
      room.pinMessage(msg.id);
    },
    [room],
  );

  const handleUnpin = useCallback(
    (msg: ChatMessage) => {
      room.unpinMessage(msg.id);
    },
    [room],
  );

  const handleScrollToIndexFailed = useCallback((info: { index: number }) => {
    if (scrollFailCountRef.current >= 5) return;
    scrollFailCountRef.current += 1;
    setTimeout(() => {
      (flatListRef.current as any)?.scrollToIndex?.({
        index: info.index,
        animated: true,
        viewPosition: 0.3,
      });
    }, 300);
  }, []);

  const handleOpenPost = useCallback(
    (postId: string) => {
      router.push({ pathname: '/(drawer)/post/[postId]', params: { postId } });
    },
    [router],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        return;
      }
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const atBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
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
    },
    [],
  );

  const scrollToBottom = useCallback(() => {
    programmaticScrollRef.current = true;
    flatListRef.current?.scrollToEnd({ animated: true });
    pinToBottomRef.current = true;
    isNearBottomRef.current = true;
    setIsNearBottom(true);
    setNewMessagesCount(0);
  }, []);

  // Auto-scroll khi có tin mới + đếm khi đang cuộn lên.
  useEffect(() => {
    const count = room.messages.length;
    if (prevMsgCountRef.current > 0 && count > prevMsgCountRef.current) {
      if (pinToBottomRef.current) {
        programmaticScrollRef.current = true;
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 50);
      } else {
        setNewMessagesCount((prev) => prev + (count - prevMsgCountRef.current));
      }
    }
    prevMsgCountRef.current = count;
  }, [room.messages.length]);

  const groupName = group?.name || t('chat.groupChat');
  const memberCount = group?.member_count ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: theme.border, backgroundColor: theme.bg },
          ]}>
          <Pressable
            onPress={() => router.navigate('/(drawer)/messages')}
            hitSlop={8}
            style={styles.backBtn}>
            <Icon name="chevronLeft" size={22} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={() => {
              if (!chatId) return;
              // typedRoutes: đường dẫn động cần cast — mirror messages.tsx.
              (router as any).push({
                pathname: '/(drawer)/group-chat/settings',
                params: { chatId },
              });
            }}
            style={styles.headerInfoBtn}>
            {group?.avatar_uri ? (
              <Image
                source={{ uri: group.avatar_uri }}
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
                <Icon name="people" size={18} color={theme.primary} />
              </View>
            )}

            <View style={styles.headerMeta}>
              <ThemedText style={styles.headerName} numberOfLines={1}>
                {groupName}
              </ThemedText>
              {memberCount > 0 && (
                <ThemedText themeColor="textSecondary" style={styles.headerMembers}>
                  {t('chat.membersCount', { count: memberCount })}
                </ThemedText>
              )}
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              setSearchActive((prev) => !prev);
              if (searchActive) {
                setSearchInput('');
                room.clearSearch();
              }
            }}
            hitSlop={8}
            style={[
              styles.headerInfoBtn,
              searchActive && { backgroundColor: theme.bgSecondary },
            ]}>
            <Icon
              name="search"
              size={18}
              color={searchActive ? theme.primary : theme.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              if (!chatId) return;
              (router as any).push({
                pathname: '/(drawer)/group-chat/settings',
                params: { chatId },
              });
            }}
            hitSlop={8}
            style={styles.headerInfoBtn}>
            <Icon name="info" size={20} color={theme.textSecondary} />
          </Pressable>

          {/* C2: gọi nhóm video — mở modal chọn thành viên (trừ khi đã trong call) */}
          <Pressable
            onPress={() => {
              if (!chatId || isInGroupCall) return;
              setCallModalOpen(true);
            }}
            disabled={isInGroupCall}
            hitSlop={8}
            style={styles.headerInfoBtn}>
            <Icon
              name="video"
              size={20}
              color={isInGroupCall ? theme.border : theme.textSecondary}
            />
          </Pressable>
        </View>

        {/* Search bar */}
        {searchActive && (
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: theme.bgSecondary,
                borderBottomColor: theme.border,
              },
            ]}>
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
                <Pressable
                  onPress={() => {
                    setSearchInput('');
                    room.clearSearch();
                  }}
                  hitSlop={8}>
                  <Icon name="close" size={14} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Pinned messages bar */}
        {room.pinnedMessages.length > 0 && !searchActive && (
          <View
            style={[
              styles.pinnedBar,
              { backgroundColor: theme.card, borderBottomColor: theme.border },
            ]}>
            <View style={styles.pinnedBarHeader}>
              <ThemedText
                style={[styles.pinnedBarTitle, { color: theme.primary }]}>
                <Icon name="pin" size={12} color={theme.primary} />{' '}
                {t('chat.pinnedMessages')} ({room.pinnedMessages.length})
              </ThemedText>
            </View>
            {room.pinnedMessages.map((pin) => (
              <Pressable
                key={pin.message_id}
                style={[
                  styles.pinnedBarItem,
                  { backgroundColor: theme.bgSecondary },
                ]}
                onPress={() => scrollToMessage(pin.message_id)}>
                <View style={styles.pinnedBarItemContent}>
                  <ThemedText
                    style={[styles.pinnedBarItemSender, { color: theme.text }]}
                    numberOfLines={1}>
                    {pin.sender_name ||
                      room.memberNames[pin.sender_id] ||
                      t('chat.unknown')}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.pinnedBarItemText,
                      { color: theme.textSecondary },
                    ]}
                    numberOfLines={1}>
                    {pin.content || t('chat.attachment')}
                  </ThemedText>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => room.unpinMessage(pin.message_id)}
                  style={styles.pinnedBarRemove}>
                  <ThemedText
                    style={{ color: theme.textSecondary, fontSize: 16 }}>
                    ×
                  </ThemedText>
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}

        {/* Messages */}
        <View style={[styles.messagesWrap, { backgroundColor: theme.bgSecondary }]}>
          {/* P3b: nền trò chuyện (layer dưới cùng, absoluteFill) */}
          {chatBackground?.value ? (
            chatBackground.type === 'solid' ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: chatBackground.value },
                ]}
              />
            ) : chatBackground.type === 'gradient' ? (
              <LinearGradient
                colors={parseGradientColors(chatBackground.value)}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Image
                source={{ uri: chatBackground.value }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            )
          ) : null}
          {room.searchResults ? (
            <View style={styles.searchResults}>
              <View
                style={[
                  styles.searchResultsHeader,
                  { borderBottomColor: theme.border },
                ]}>
                <ThemedText
                  style={[styles.searchResultsTitle, { color: theme.text }]}>
                  {t('chat.searchResults', { keyword: room.searchKeyword })}
                </ThemedText>
                <Pressable
                  onPress={() => {
                    setSearchInput('');
                    room.clearSearch();
                  }}
                  hitSlop={8}>
                  <Icon name="close" size={14} color={theme.textSecondary} />
                </Pressable>
              </View>
              {room.searchResults.length === 0 ? (
                <View style={styles.center}>
                  <ThemedText themeColor="textSecondary">
                    {t('chat.noResults')}
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  data={room.searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.searchResultItem,
                        { borderBottomColor: theme.border },
                      ]}
                      onPress={() => {
                        // Đóng kết quả → nhảy tới tin gốc + highlight.
                        setSearchInput('');
                        room.clearSearch();
                        setTimeout(() => {
                          scrollToMessage(item.id);
                          setFlashId(item.id);
                        }, 80);
                      }}>
                      <ThemedText
                        style={[
                          styles.searchResultSender,
                          { color: theme.primary },
                        ]}>
                        {item.sender_id === myUserId
                          ? t('chat.you')
                          : item.sender_name ||
                            room.memberNames[item.sender_id] ||
                            t('chat.unknown')}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.searchResultContent,
                          { color: theme.text },
                        ]}
                        numberOfLines={2}>
                        {item.deleted
                          ? t('chat.messageDeleted')
                          : item.content || t('chat.attachment')}
                      </ThemedText>
                    </Pressable>
                  )}
                />
              )}
            </View>
          ) : room.loading ? (
            <View style={styles.center}>
              <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
            </View>
          ) : room.messages.length === 0 && room.callHistory.length === 0 ? (
            <View style={styles.center}>
              <ThemedText themeColor="textSecondary">{t('chat.noMessages')}</ThemedText>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={timeline}
              keyExtractor={(item: GroupedItem) =>
                'kind' in item
                  ? item.kind === 'group_call'
                    ? `gc-${item.call.call_id}`
                    : `grp-${item.msgs[0]?.id ?? item.msgs.length}`
                  : item.id
              }
              onScrollToIndexFailed={handleScrollToIndexFailed}
              renderItem={({ item, index }: { item: GroupedItem; index: number }) => {
                const prev = resolvePrevMsg(timeline, index);
                const dateSep = (createdAt: string) => (
                  <View style={styles.dateSep}>
                    <View
                      style={[styles.dateSepLine, { backgroundColor: theme.border }]}
                    />
                    <ThemedText
                      style={[styles.dateSepText, { color: theme.textSecondary }]}>
                      {formatChatDate(createdAt, t)}
                    </ThemedText>
                    <View
                      style={[styles.dateSepLine, { backgroundColor: theme.border }]}
                    />
                  </View>
                );

                if ('kind' in item) {
                  if (item.kind === 'group_call') {
                    const gc = item.call;
                    return (
                      <GroupCallHistoryBubble
                        call={gc}
                        myUserId={myUserId}
                        callerName={
                          gc.caller_id === myUserId
                            ? t('groupCall.callerYou')
                            : room.memberNames[gc.caller_id] || t('chat.unknown')
                        }
                        activeCallId={activeGroupCallId}
                        onRequestJoin={(callId) => {
                          Alert.alert(
                            t('groupCall.requestJoin'),
                            t('groupCall.pendingRequestBody', {
                              name:
                                room.memberNames[gc.caller_id] ||
                                t('chat.unknown'),
                            }),
                            [
                              { text: t('common.cancel'), style: 'cancel' },
                              {
                                text: t('groupCall.join'),
                                onPress: () => void joinGroupCall(callId),
                              },
                            ],
                          );
                        }}
                      />
                    );
                  }
                  const groupMine = item.msgs[0]?.sender_id === myUserId;
                  return (
                    <View
                      style={[
                        styles.mediaGroupRow,
                        groupMine ? styles.rowMine : styles.rowTheirs,
                      ]}>
                      <MediaStack
                        msgs={item.msgs}
                        onOpen={(i) => setLightbox({ msgs: item.msgs, index: i })}
                        onLongPress={handleLongPress}
                      />
                    </View>
                  );
                }

                const msg = item;
                const showDate =
                  !prev ||
                  formatChatDate(msg.created_at, t) !==
                    formatChatDate(prev.createdAt, t);
                const showTime =
                  !prev ||
                  prev.senderId !== msg.sender_id ||
                  new Date(msg.created_at).getTime() -
                    new Date(prev.createdAt).getTime() >
                    60000;
                const showAvatar = !prev || prev.senderId !== msg.sender_id;

                if (isSystemMessage(msg)) {
                  return (
                    <Fragment key={msg.id}>
                      {showDate && dateSep(msg.created_at)}
                      <SystemMessage
                        message={msg}
                        myUserId={myUserId}
                        memberNames={room.memberNames}
                      />
                    </Fragment>
                  );
                }

                return (
                  <Fragment key={msg.id}>
                    {showDate && dateSep(msg.created_at)}
                    <ChatBubble
                      message={msg}
                      isMine={msg.sender_id === myUserId}
                      showTime={showTime}
                      seen={
                        msg.sender_id === myUserId &&
                        (msg.seen_by ?? []).some((uid) => uid !== myUserId)
                      }
                      emojis={serverEmojis}
                      myUserId={myUserId}
                      avatarUri={msg.sender_avatar ?? null}
                      showAvatar={showAvatar}
                      senderName={senderLabel(msg)}
                      highlight={flashId === msg.id}
                      onLongPress={handleLongPress}
                      onReplyPress={handleReplyPress}
                      onMediaPress={handleMediaPress}
                      onOpenPost={handleOpenPost}
                      onReact={handleReact}
                    />
                  </Fragment>
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
          )}

          {room.typingUsers.size > 0 && <TypingIndicator />}
        </View>

        {/* New messages bar */}
        {newMessagesCount > 0 && !isNearBottom && (
          <Pressable
            style={[styles.newMessagesBar, { backgroundColor: theme.primary }]}
            onPress={scrollToBottom}>
            <ThemedText style={styles.newMessagesText}>
              ↓ {newMessagesCount} {t('chat.scrollToLower')}
            </ThemedText>
          </Pressable>
        )}

        {/* Composer */}
        <ChatComposer
          onSend={handleSend}
          onSendVoice={handleSendVoice}
          onTyping={handleTyping}
          replyingTo={replyingTo}
          replySenderLabel={replySenderLabel}
          onClearReply={() => setReplyingTo(null)}
          forwarding={forwardDraft}
          onClearForward={() => setForwardDraft(null)}
        />
      </KeyboardAvoidingView>

      {/* Message actions menu */}
      <MessageActions
        message={actionTarget}
        myUserId={myUserId}
        isPinned={
          actionTarget
            ? room.pinnedMessages.some((p) => p.message_id === actionTarget.id)
            : false
        }
        canPin
        onClose={() => setActionTarget(null)}
        onReply={handleReply}
        onDelete={handleDeleteRequest}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onReact={handleReact}
        onForward={handleForward}
        onRetry={handleRetry}
        onDiscard={handleDiscard}
      />

      {/* Chọn hội thoại đích khi chuyển tiếp */}
      <ForwardPickerModal
        visible={!!forwardPickerFor}
        excludeChatId={chatId}
        onClose={() => setForwardPickerFor(null)}
        onPick={handleForwardPick}
      />

      {/* C2: modal chọn thành viên gọi nhóm video */}
      {chatId && (
        <GroupCallMemberSelectModal
          visible={callModalOpen}
          onClose={() => setCallModalOpen(false)}
          chatId={chatId}
          onStartCall={(ids) => {
            void startGroupCall(chatId, ids);
          }}
        />
      )}

      {/* Delete message confirmation */}
      {deleteTarget && (
        <View style={styles.deleteOverlay}>
          <Pressable
            style={styles.deleteOverlayBg}
            onPress={() => setDeleteTarget(null)}
          />
          <View style={[styles.deleteDialog, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.deleteTitle, { color: theme.text }]}>
              {t('chat.deleteMessage')}
            </ThemedText>
            <ThemedText style={[styles.deleteDesc, { color: theme.textSecondary }]}>
              {t('chat.deleteConfirm')}
            </ThemedText>
            <View style={styles.deleteActions}>
              <Pressable
                style={[styles.deleteBtn, { backgroundColor: theme.bgSecondary }]}
                onPress={() => handleConfirmDelete('me')}>
                <ThemedText style={[styles.deleteBtnText, { color: theme.text }]}>
                  {t('chat.deleteForMe')}
                </ThemedText>
              </Pressable>
              {deleteTarget.sender_id === myUserId && (
                <Pressable
                  style={[styles.deleteBtn, { backgroundColor: theme.danger }]}
                  onPress={() => handleConfirmDelete('all')}>
                  <ThemedText style={[styles.deleteBtnText, { color: '#FFF' }]}>
                    {t('chat.deleteForAll')}
                  </ThemedText>
                </Pressable>
              )}
            </View>
            <Pressable style={styles.deleteCancel} onPress={() => setDeleteTarget(null)}>
              <ThemedText
                style={[styles.deleteCancelText, { color: theme.textSecondary }]}>
                {t('common.cancel')}
              </ThemedText>
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
  headerInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
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
  headerMeta: {
    flex: 1,
    gap: 1,
  },
  headerName: {
    ...Typography.body,
    fontWeight: '600',
  },
  headerMembers: {
    ...Typography.caption,
    fontSize: 11,
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
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  dateSepLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dateSepText: {
    ...Typography.caption,
    fontSize: 11,
  },
  mediaGroupRow: {
    marginVertical: 2,
  },
  rowMine: {
    alignItems: 'flex-end',
  },
  rowTheirs: {
    alignItems: 'flex-start',
  },
  newMessagesBar: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 16,
  },
  newMessagesText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 50,
  },
  deleteOverlayBg: {
    ...StyleSheet.absoluteFill,
  },
  deleteDialog: {
    marginHorizontal: Spacing.xl,
    borderRadius: 14,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  deleteTitle: {
    ...Typography.body,
    fontWeight: '700',
  },
  deleteDesc: {
    ...Typography.caption,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  deleteCancelText: {
    ...Typography.body,
    fontSize: 13,
  },
});
