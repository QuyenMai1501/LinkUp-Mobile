import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { batchGetPresence } from "@/api/presence";
import { deleteChat, listChats, uploadChatMedia } from "@/api/chat";
import { CallHistoryRow } from "@/components/chat/call-history-row";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ForwardPickerModal } from "@/components/chat/forward-picker-modal";
import { MediaLightbox } from "@/components/chat/media-lightbox";
import { MediaStack } from "@/components/chat/media-stack";
import { MessageActions } from "@/components/chat/message-actions";
import {
  SystemMessage,
  isSystemMessage,
} from "@/components/chat/system-message";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useCall } from "@/contexts/call-context";
import { useTheme } from "@/hooks/use-theme";
import { useChatCallHistory } from "@/hooks/useChatCallHistory";
import { useChatE2E } from "@/hooks/useChatE2E";
import { useChatRoom } from "@/hooks/useChatRoom";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useE2ERecovery } from "@/hooks/useE2ERecovery";
import { useServerEmojis } from "@/hooks/use-server-emojis";
import { useTranslation } from "@/hooks/useTranslation";
import type { CallHistoryItem } from "@/types/call";
import type {
  ChatConversation,
  ChatMessage,
  ReplyPreview,
} from "@/types/chat";
import { formatChatDate } from "@/utils/chat";
import { RECOVERY_RESOLVED_KEY } from "@/utils/e2e-flags";
import { stashForwardDraft, takeForwardDraft } from "@/utils/forward-draft";
import {
  groupMediaTimeline,
  type MediaGroupItem,
} from "@/utils/chatMediaGroup";

type CallTimelineItem = { kind: "call"; item: CallHistoryItem };
type GroupedItem = ChatMessage | MediaGroupItem | CallTimelineItem;

/** Prev item cho date-separator/showTime: group media → tin cuối; call → thời điểm gọi. */
function resolvePrevMsg(
  items: GroupedItem[],
  index: number,
): { createdAt: string; senderId: string } | undefined {
  const prev = items[index - 1];
  if (!prev) return undefined;
  if ("kind" in prev) {
    if (prev.kind === "call") {
      return {
        createdAt: new Date(prev.item.created_at).toISOString(),
        senderId: "",
      };
    }
    const last = prev.msgs[prev.msgs.length - 1];
    return last
      ? { createdAt: last.created_at, senderId: last.sender_id }
      : undefined;
  }
  return { createdAt: prev.created_at, senderId: prev.sender_id };
}

// Job upload media local — giữ file để retry nếu upload thất bại (chưa có
// wire payload trên server nên retryMessage gửi lại không được).
type UploadJob = {
  file: { uri: string; name: string; type: string };
  durationSeconds?: number;
  caption?: string;
  replyToMessageId?: string;
};

// Preview reply cho bubble optimistic — content trong list tin đã giải mã
// nên render raw (không set e2e_version/decrypting).
function buildReplyPreview(
  m: ChatMessage,
  senderLabel: string,
): ReplyPreview {
  return {
    id: m.id,
    content: m.content ?? "",
    sender_id: m.sender_id,
    sender_name: senderLabel,
    sender_avatar: m.sender_avatar ?? "",
    decrypted: true,
  };
}

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { startCall, phase: callPhase, isInCall, call: activeCall } = useCall();
  const socket = useChatSocket();
  const myUserId = user?.id ?? "";

  // Gắn chatId vào state: navigate giữa 2 chat khác nhau thì conversation cũ
  // còn partner của chat TRƯỚC → derive `conversation` chỉ khi khớp chatId,
  // tránh ensureChatKey chạy với partner sai (derive sai shared secret).
  const [convEntry, setConvEntry] = useState<{
    chatId: string;
    conv: ChatConversation;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  // Giới hạn retry của onScrollToIndexFailed (index offscreen chưa render kịp).
  const scrollFailCountRef = useRef(0);

  // Message actions state
  const [actionTarget, setActionTarget] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [showDeleteChat, setShowDeleteChat] = useState(false);
  // B1: draft chuyển tiếp (rút từ forward-draft store — navigate sang instance
  // mới nên state không truyền trực tiếp được) + tin đang chọn để chuyển.
  const [forwardDraft, setForwardDraft] = useState<{
    messageId: string;
    content: string;
    emojiId?: string;
  } | null>(null);
  const [forwardPickerFor, setForwardPickerFor] = useState<ChatMessage | null>(
    null,
  );
  // A4: online của đối phương — batch presence khi mở + presence:update realtime.
  const [partnerOnline, setPartnerOnline] = useState(false);
  // B5: nhấp nháy highlight khi nhảy tới tin từ kết quả tìm kiếm.
  const [flashId, setFlashId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    msgs: ChatMessage[];
    index: number;
  } | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchInput, setSearchInput] = useState("");
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
        if (conv) setConvEntry({ chatId, conv });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const conversation =
    convEntry && convEntry.chatId === chatId ? convEntry.conv : null;
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

  const callHistory = useChatCallHistory({
    partnerUserId,
    callPhase,
    activeCall,
  });

  // Emoji server (sticker render + reaction chip) — cache module.
  const { byId: serverEmojis } = useServerEmojis();

  // B6: deep-link vào chat khi cổng khôi phục E2E chưa mở → đá về danh sách
  // (RecoveryGateModal chỉ render ở messages.tsx).
  const e2eRecovery = useE2ERecovery();
  useEffect(() => {
    if (!chatId || e2eRecovery.meta === null) return;
    let cancelled = false;
    void (async () => {
      let seen = false;
      try {
        seen =
          (await AsyncStorage.getItem(RECOVERY_RESOLVED_KEY)) === "1";
      } catch {
        /* storage lỗi → coi như chưa thấy */
      }
      if (cancelled || seen) return;
      if (e2eRecovery.meta?.has_blob && e2eRecovery.meta?.salt) {
        router.replace("/(drawer)/messages");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, e2eRecovery.meta, router]);

  // B1: rút draft chuyển tiếp khi đổi chat (null nếu không có → dọn state cũ).
  // setState sau await — tránh react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const taken = takeForwardDraft(chatId ?? "");
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

  // A4: lần đầu biết partner → batch query trạng thái online.
  // Reset về offline sau await — tránh react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!partnerUserId) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setPartnerOnline(false);
      try {
        const res = await batchGetPresence([partnerUserId]);
        if (cancelled) return;
        setPartnerOnline(res.data[partnerUserId]?.status === "online");
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerUserId]);

  // A4: realtime — server broadcast presence:update cho toàn bộ client.
  useEffect(() => {
    if (!partnerUserId) return;
    const unsub = socket.subscribe("presence:update", (payload: any) => {
      if (payload.user_id === partnerUserId) {
        setPartnerOnline(payload.status === "online");
      }
    });
    return unsub;
  }, [socket, partnerUserId]);

  // B5: tự tắt highlight sau một nhịp.
  useEffect(() => {
    if (!flashId) return;
    const timer = setTimeout(() => setFlashId(null), 1600);
    return () => clearTimeout(timer);
  }, [flashId]);

  // Timeline gộp messages (đã group media) + lịch sử cuộc gọi, sort theo thời gian.
  const timeline = useMemo<GroupedItem[]>(() => {
    const created = (g: GroupedItem): number => {
      if ("kind" in g) {
        if (g.kind === "call") return g.item.created_at;
        const first = g.msgs[0];
        return first ? new Date(first.created_at).getTime() : 0;
      }
      return new Date(g.created_at).getTime();
    };
    const callItems: CallTimelineItem[] = callHistory.map((item) => ({
      kind: "call",
      item,
    }));
    return [...groupMediaTimeline(room.messages), ...callItems].sort(
      (a, b) => created(a) - created(b),
    );
  }, [room.messages, callHistory]);

  /** Index trên mảng timeline (group media/call chiếm 1 slot) — dùng cho scrollToIndex. */
  const findIndexInGrouped = useCallback(
    (messageId: string): number => {
      for (let i = 0; i < timeline.length; i++) {
        const item = timeline[i];
        if ("kind" in item) {
          if (item.kind === "call") continue;
          if (item.msgs.some((m) => m.id === messageId)) return i;
        } else if (item.id === messageId) {
          return i;
        }
      }
      return -1;
    },
    [timeline],
  );

  const partner = conversation?.partner;

  // Tên người nhắn trong ô phản hồi — server không gửi sender_name cho chat
  // 1-1 (omitempty rỗng) → tự resolve: mình hiện "Bạn", đối phương lấy tên
  // từ partner, thiếu nữa mới hiện "Không xác định".
  const replySenderLabel = replyingTo
    ? replyingTo.sender_id === myUserId
      ? t("chat.you")
      : replyingTo.sender_name || partner?.display_name || t("chat.unknown")
    : undefined;

  // Job upload đang chạy / lỗi — retry upload lại từ job này (chưa có wire).
  const uploadJobsRef = useRef<Map<string, UploadJob>>(new Map());

  // Upload nền: xong → completeMediaUpload (ghi media + gửi WS); lỗi → bubble
  // failed, giữ job để retry. Nếu bubble đã bị bỏ trong lúc upload → hủy.
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
        if (!uploadJobsRef.current.has(tempId)) return; // đã bị bỏ — khỏi báo lỗi
        room.failUpload(tempId);
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert(t("common.error"), msg || t("chat.uploadFailed"));
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
      // Chưa phân loại E2E (conversation/partner chưa load xong) hoặc E2E chưa
      // sẵn sàng / đối phương đã đổi thiết bị → chặn gửi ngay (trước cả khi
      // upload media), không silent fallback về plaintext.
      if (
        encryption.status === "unavailable" ||
        encryption.status === "loading"
      ) {
        Alert.alert(t("chat.e2eInitializing"));
        return;
      }
      if (encryption.status === "partner_changed") {
        Alert.alert(t("chat.e2ePartnerChanged"));
        return;
      }

      // GIF từ GIPHY -> gửi ngay dưới dạng gif_url (server tạo media từ URL).
      if (gifUrl) {
        setForwardDraft(null); // gif + forward không gửi cùng — bỏ draft
        room.sendMessage("", { gifUrl, replyToMessageId: replyingTo?.id });
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
          // Bubble hiện NGAY với file local; upload chạy nền rồi mới gửi WS
          // (completeMediaUpload lo encrypt caption + append hàng đợi echo).
          const tempId = room.beginMediaUpload({
            localUri: att.uri,
            mediaType: att.type,
            content: isFirst ? caption : "",
            replyTo:
              isFirst && replyingTo && replySenderLabel
                ? buildReplyPreview(replyingTo, replySenderLabel)
                : null,
            replyToMessageId: isFirst ? replyingTo?.id : undefined,
          });
          if (!tempId) continue;
          const job: UploadJob = {
            file: att,
            caption: isFirst ? caption : "",
            replyToMessageId: isFirst ? replyingTo?.id : undefined,
          };
          uploadJobsRef.current.set(tempId, job);
          // Upload tuần tự (await) — thứ tự bubble = thứ tự wire/echo.
          await runUpload(tempId, job);
        }
        setReplyingTo(null);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return;
      }

      // Text-only message — encrypt do useChatRoom.sendMessage đảm nhận.
      // Bubble tạm giữ plaintext, echo server về thay temp theo id.
      // B1: sticker-forward gửi đúng emoji_id gốc (content rỗng).
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
    [room, encryption, replyingTo, replySenderLabel, forwardDraft, chatId, t, runUpload],
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      room.sendTyping(isTyping);
    },
    [room],
  );

  // Tin nhắn thoại: append bubble NGAY với file local (uploading), upload
  // nền rồi mới gửi WS — không để người dùng chờ upload trong im lặng.
  const handleSendVoice = useCallback(
    (
      file: { uri: string; name: string; type: string },
      durationSec: number,
    ) => {
      if (!chatId) return;
      // Cùng guard E2E với handleSend — chặn trước khi upload.
      if (
        encryption.status === "unavailable" ||
        encryption.status === "loading"
      ) {
        Alert.alert(t("chat.e2eInitializing"));
        return;
      }
      if (encryption.status === "partner_changed") {
        Alert.alert(t("chat.e2ePartnerChanged"));
        return;
      }
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
      setReplyingTo(null); // bubble optimistic đã chứa preview reply
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      void runUpload(tempId, job);
    },
    [chatId, encryption, room, replyingTo, replySenderLabel, t, runUpload],
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

  // B2: toggle reaction (từ chip trên bubble hoặc quick-react trong menu).
  const handleReact = useCallback(
    (messageId: string, emojiId: string) => {
      room.reactToMessage(messageId, emojiId);
    },
    [room],
  );

  // A2: gửi lại tin thất bại — upload fail → chạy lại upload (còn job local);
  // WS fail → gửi lại wire payload đã lưu.
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
      uploadJobsRef.current.delete(msg.id); // hủy upload đang chạy (nếu có)
      room.discardMessage(msg.id);
    },
    [room],
  );

  // B1: mở picker chọn hội thoại đích.
  const handleForward = useCallback((msg: ChatMessage) => {
    setForwardPickerFor(msg);
  }, []);

  const handleForwardPick = useCallback(
    (targetChatId: string) => {
      const msg = forwardPickerFor;
      setForwardPickerFor(null);
      if (!msg) return;
      stashForwardDraft({
        chatId: targetChatId,
        messageId: msg.id,
        content: msg.deleted ? "" : (msg.content ?? ""),
        emojiId: msg.emoji_id ?? undefined,
      });
      (router as any).push(`/(drawer)/chat/${targetChatId}`);
    },
    [forwardPickerFor, router],
  );

  const handleMediaPress = useCallback(
    (msg: ChatMessage) => {
      // Find all media messages in sequence for lightbox navigation
      // (tin nhắn thoại render bằng VoicePlayer — không vào lightbox).
      const mediaMsgs = room.messages.filter(
        (m) =>
          !m.deleted &&
          !m.decrypt_failed &&
          (m.media_id || m.media_uri) &&
          !m.media_type?.startsWith("audio/"),
      );
      const idx = mediaMsgs.findIndex((m) => m.id === msg.id);
      setLightbox({ msgs: mediaMsgs, index: idx >= 0 ? idx : 0 });
    },
    [room.messages],
  );

  const handleConfirmDelete = useCallback(
    (mode: "all" | "me") => {
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

  // FlatList không có getItemLayout (item cao độ biến thiên) → index offscreen
  // chưa được đo sẽ fail; retry có biên để tránh loop vô hạn nếu index không tồn tại.
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
      router.push({ pathname: "/(drawer)/post/[postId]", params: { postId } });
    },
    [router],
  );

  const handleCallBack = useCallback(
    (item: CallHistoryItem) => {
      if (isInCall) return;
      void startCall(
        {
          user_id: item.other_user.id,
          display_name: item.other_user.display_name,
          avatar_uri: item.other_user.avatar_url,
        },
        item.call_type,
      );
    },
    [isInCall, startCall],
  );

  const handleDeleteChat = useCallback(async () => {
    if (!chatId) return;
    try {
      await deleteChat(chatId);
      setShowDeleteChat(false);
      router.navigate("/(drawer)/messages");
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
    if (
      prevMsgCountRef.current > 0 &&
      count > prevMsgCountRef.current &&
      room.searchResults === null
    ) {
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: theme.border, backgroundColor: theme.bg },
          ]}>
          <Pressable
            onPress={() => router.navigate("/(drawer)/messages")}
            hitSlop={8}
            style={styles.backBtn}>
            <ThemedText style={styles.backIcon}>←</ThemedText>
          </Pressable>

          {partner?.avatar_uri ? (
            <Image
              source={{ uri: partner.avatar_uri }}
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
              <ThemedText
                style={[styles.avatarLetter, { color: theme.primary }]}>
                {(partner?.display_name || "?")[0]?.toUpperCase()}
              </ThemedText>
            </View>
          )}

          <View style={styles.headerMeta}>
            <ThemedText style={styles.headerName} numberOfLines={1}>
              {partner?.display_name || t("chat.unknown")}
            </ThemedText>
            <View style={styles.headerMetaRow}>
              {encryption.ready && (
                <ThemedText style={styles.e2eBadge}>
                  <Icon name="lock" size={12} /> {t("chat.e2eBadge")}
                </ThemedText>
              )}
              {/* A4: trạng thái online/offline của đối phương */}
              {partner && (
                <ThemedText
                  style={[
                    styles.presenceBadge,
                    { color: partnerOnline ? "#22C55E" : theme.textSecondary },
                  ]}>
                  {partnerOnline ? t("chat.online") : t("chat.offline")}
                </ThemedText>
              )}
            </View>
          </View>

          {partner && (
            <>
              <Pressable
                onPress={() =>
                  startCall(
                    {
                      user_id: partner.user_id,
                      display_name: partner.display_name,
                      avatar_uri: partner.avatar_uri,
                    },
                    "voice",
                  )
                }
                hitSlop={8}
                style={styles.headerAction}>
                <Icon name="call" size={18} color={theme.textSecondary} />
              </Pressable>

              <Pressable
                onPress={() =>
                  startCall(
                    {
                      user_id: partner.user_id,
                      display_name: partner.display_name,
                      avatar_uri: partner.avatar_uri,
                    },
                    "video",
                  )
                }
                hitSlop={8}
                style={styles.headerAction}>
                <Icon name="video" size={18} color={theme.textSecondary} />
              </Pressable>
            </>
          )}

          <Pressable
            onPress={() => {
              setSearchActive((prev) => !prev);
              if (searchActive) {
                setSearchInput("");
                room.clearSearch();
              }
            }}
            hitSlop={8}
            style={[
              styles.headerAction,
              searchActive && { backgroundColor: theme.bgSecondary },
            ]}>
            <Icon
              name="search"
              size={18}
              color={searchActive ? theme.primary : theme.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={() => setShowDeleteChat(true)}
            hitSlop={8}
            style={styles.headerAction}>
            <Icon name="trash" size={18} color={theme.textSecondary} />
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
                placeholder={t("chat.searchMessages")}
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />
              {searchInput.length > 0 && (
                <Pressable
                  onPress={() => {
                    setSearchInput("");
                    room.clearSearch();
                  }}
                  hitSlop={8}>
                  <Icon name="close" size={14} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* E2E warning: đối phương đổi identity/thiết bị */}
        {encryption.status === "partner_changed" && (
          <View
            style={[
              styles.e2eWarningBanner,
              { backgroundColor: theme.danger + "1A" },
            ]}>
            <Icon name="shield" size={14} color={theme.danger} />
            <ThemedText
              style={[styles.e2eWarningText, { color: theme.danger }]}>
              {t("chat.e2ePartnerChanged")}
            </ThemedText>
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
                <Icon name="pin" size={12} color={theme.primary} />{" "}
                {t("chat.pinnedMessages")} ({room.pinnedMessages.length})
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
                    {pin.sender_name || t("chat.unknown")}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.pinnedBarItemText,
                      { color: theme.textSecondary },
                    ]}
                    numberOfLines={1}>
                    {pin.decrypt_failed
                      ? t("chat.undecryptable")
                      : pin.decrypted || !pin.e2e_version
                        ? pin.content.length > 10
                          ? pin.content.slice(0, 10) + "..."
                          : pin.content || t("chat.attachment")
                        : t("chat.decrypting")}
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
        <View
          style={[styles.messagesWrap, { backgroundColor: theme.bgSecondary }]}>
          {room.searchResults ? (
            <View style={styles.searchResults}>
              <View
                style={[
                  styles.searchResultsHeader,
                  { borderBottomColor: theme.border },
                ]}>
                <ThemedText
                  style={[styles.searchResultsTitle, { color: theme.text }]}>
                  {t("chat.searchResults", { keyword: room.searchKeyword })}
                </ThemedText>
                <Pressable
                  onPress={() => {
                    setSearchInput("");
                    room.clearSearch();
                  }}
                  hitSlop={8}>
                  <Icon name="close" size={14} color={theme.textSecondary} />
                </Pressable>
              </View>
              {room.searchResults.length === 0 ? (
                <View style={styles.center}>
                  <ThemedText themeColor="textSecondary">
                    {t("chat.noResults")}
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
                        // B5: đóng kết quả → nhảy tới tin gốc + highlight.
                        setSearchInput("");
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
                          ? t("chat.you")
                          : item.sender_name ||
                            partner?.display_name ||
                            t("chat.unknown")}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.searchResultContent,
                          { color: theme.text },
                        ]}
                        numberOfLines={2}>
                        {item.deleted
                          ? t("chat.messageDeleted")
                          : item.content || t("chat.attachment")}
                      </ThemedText>
                    </Pressable>
                  )}
                />
              )}
            </View>
          ) : room.loading ? (
            <View style={styles.center}>
              <ThemedText themeColor="textSecondary">
                {t("common.loading")}
              </ThemedText>
            </View>
          ) : room.messages.length === 0 && callHistory.length === 0 ? (
            <View style={styles.center}>
              <ThemedText themeColor="textSecondary">
                {t("chat.noMessages")}
              </ThemedText>
            </View>
          ) : (
            <>
              {room.hasMore && (
                <View style={styles.loadMoreRow}>
                  {room.loadingMore ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <ThemedText
                      themeColor="textSecondary"
                      style={styles.loadMoreText}>
                      {t("chat.scrollForOlder")}
                    </ThemedText>
                  )}
                </View>
              )}
              <FlatList
                ref={flatListRef}
                data={timeline}
                keyExtractor={(item: GroupedItem) =>
                  "kind" in item
                    ? item.kind === "call"
                      ? `call-${item.item.id}`
                      : `grp-${item.msgs[0]?.id ?? item.msgs.length}`
                    : item.id
                }
                onScrollToIndexFailed={handleScrollToIndexFailed}
                renderItem={({
                  item,
                  index,
                }: {
                  item: GroupedItem;
                  index: number;
                }) => {
                  const prev = resolvePrevMsg(timeline, index);
                  const dateSep = (createdAt: string) => (
                    <View style={styles.dateSep}>
                      <View
                        style={[
                          styles.dateSepLine,
                          { backgroundColor: theme.border },
                        ]}
                      />
                      <ThemedText
                        style={[
                          styles.dateSepText,
                          { color: theme.textSecondary },
                        ]}>
                        {formatChatDate(createdAt, t)}
                      </ThemedText>
                      <View
                        style={[
                          styles.dateSepLine,
                          { backgroundColor: theme.border },
                        ]}
                      />
                    </View>
                  );

                  if ("kind" in item && item.kind === "call") {
                    const iso = new Date(item.item.created_at).toISOString();
                    const showDate =
                      !prev ||
                      formatChatDate(iso, t) !==
                        formatChatDate(prev.createdAt, t);
                    return (
                      <Fragment key={`call-${item.item.id}`}>
                        {showDate && dateSep(iso)}
                        <CallHistoryRow
                          item={item.item}
                          partnerAvatar={partner?.avatar_uri}
                          partnerName={partner?.display_name}
                          isInCall={isInCall}
                          onCallback={handleCallBack}
                        />
                      </Fragment>
                    );
                  }

                  if ("kind" in item) {
                    const groupMine = item.msgs[0]?.sender_id === myUserId;
                    return (
                      <View
                        style={[
                          styles.groupRow,
                          groupMine
                            ? styles.groupRowMine
                            : styles.groupRowTheirs,
                        ]}>
                        <MediaStack
                          msgs={item.msgs}
                          onOpen={(i) =>
                            setLightbox({ msgs: item.msgs, index: i })
                          }
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
                          partnerUserId={partner?.user_id}
                          partnerName={partner?.display_name}
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
                        isPinned={room.pinnedMessages.some(
                          (p) => p.message_id === msg.id,
                        )}
                        seen={
                          msg.sender_id === myUserId &&
                          (msg.seen_by ?? []).some((uid) => uid !== myUserId)
                        }
                        highlight={flashId === msg.id}
                        emojis={serverEmojis}
                        myUserId={myUserId}
                        avatarUri={
                          partner?.avatar_uri ?? msg.sender_avatar ?? null
                        }
                        showAvatar={showAvatar}
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
            </>
          )}

          {room.partnerTyping && <TypingIndicator />}
        </View>

        {/* New messages bar – like Web */}
        {newMessagesCount > 0 && !isNearBottom && (
          <Pressable
            style={[styles.newMessagesBar, { backgroundColor: theme.primary }]}
            onPress={scrollToBottom}>
            <ThemedText style={styles.newMessagesText}>
              ↓ {newMessagesCount} {t("chat.scrollToLower")}
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

      {/* B1: chọn hội thoại đích khi chuyển tiếp */}
      <ForwardPickerModal
        visible={!!forwardPickerFor}
        excludeChatId={chatId}
        onClose={() => setForwardPickerFor(null)}
        onPick={handleForwardPick}
      />

      {/* Delete conversation confirmation */}
      {showDeleteChat && (
        <View style={styles.deleteOverlay}>
          <Pressable
            style={styles.deleteOverlayBg}
            onPress={() => setShowDeleteChat(false)}
          />
          <View style={[styles.deleteDialog, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.deleteTitle, { color: theme.text }]}>
              {t("chat.deleteChat")}
            </ThemedText>
            <ThemedText
              style={[styles.deleteDesc, { color: theme.textSecondary }]}>
              {t("chat.deleteChatConfirm")}
            </ThemedText>
            <View style={styles.deleteActions}>
              <Pressable
                style={[
                  styles.deleteBtn,
                  { backgroundColor: theme.bgSecondary },
                ]}
                onPress={() => setShowDeleteChat(false)}>
                <ThemedText
                  style={[styles.deleteBtnText, { color: theme.text }]}>
                  {t("common.cancel")}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.deleteBtn, { backgroundColor: theme.danger }]}
                onPress={handleDeleteChat}>
                <ThemedText style={[styles.deleteBtnText, { color: "#FFF" }]}>
                  {t("chat.delete")}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
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
              {t("chat.deleteMessage")}
            </ThemedText>
            <ThemedText
              style={[styles.deleteDesc, { color: theme.textSecondary }]}>
              {t("chat.deleteConfirm")}
            </ThemedText>
            <View style={styles.deleteActions}>
              <Pressable
                style={[
                  styles.deleteBtn,
                  { backgroundColor: theme.bgSecondary },
                ]}
                onPress={() => handleConfirmDelete("me")}>
                <ThemedText
                  style={[styles.deleteBtnText, { color: theme.text }]}>
                  {t("chat.deleteForMe")}
                </ThemedText>
              </Pressable>
              {deleteTarget.sender_id === myUserId && (
                <Pressable
                  style={[styles.deleteBtn, { backgroundColor: theme.danger }]}
                  onPress={() => handleConfirmDelete("all")}>
                  <ThemedText style={[styles.deleteBtnText, { color: "#FFF" }]}>
                    {t("chat.deleteForAll")}
                  </ThemedText>
                </Pressable>
              )}
            </View>
            <Pressable
              style={styles.deleteCancel}
              onPress={() => setDeleteTarget(null)}>
              <ThemedText
                style={[
                  styles.deleteCancelText,
                  { color: theme.textSecondary },
                ]}>
                {t("common.cancel")}
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
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
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
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  presenceBadge: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "600",
  },
  headerAction: {
    padding: Spacing.xs,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchResultsTitle: {
    ...Typography.body,
    fontWeight: "600",
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
    fontWeight: "600",
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
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    paddingVertical: Spacing.sm,
  },
  groupRow: {
    marginVertical: 2,
    paddingHorizontal: Spacing.md,
  },
  groupRowMine: {
    alignItems: "flex-end",
  },
  groupRowTheirs: {
    alignItems: "flex-start",
  },
  dateSep: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  pinnedBarTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  pinnedBarItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    fontWeight: "600",
  },
  pinnedBarItemText: {
    fontSize: 12,
  },
  pinnedBarRemove: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  e2eWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  e2eWarningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  newMessagesBar: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingVertical: 6,
    marginHorizontal: Spacing.md,
    marginBottom: -4,
    borderRadius: 20,
  },
  newMessagesText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
  // Delete confirmation dialog
  deleteOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteOverlayBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  deleteDialog: {
    width: "80%",
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
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  deleteBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontWeight: "600",
    fontSize: 14,
  },
  deleteCancel: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: Spacing.xs,
  },
  deleteCancelText: {
    fontSize: 14,
  },
});
