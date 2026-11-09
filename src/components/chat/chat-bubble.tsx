import { Image } from "expo-image";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { isSingleEmojifyiUrl } from "@/api/emojifyi";
import {
  giphyStillUrl,
  isSingleGiphyUrl,
  separateGiphyUrls,
} from "@/api/giphy";
import { EmojiImage } from "@/components/chat/emoji-image";
import { MessageMedia } from "@/components/chat/message-media";
import { QuickHeart } from "@/components/chat/quick-heart";
import { ReactionBadges } from "@/components/chat/reaction-badges";
import { SharedPostBubble } from "@/components/chat/shared-post-bubble";
import { VideoLinkPreview } from "@/components/chat/video-link-preview";
import { RichContent } from "@/components/rich-content";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/useTranslation";
import type { ChatMessage } from "@/types/chat";
import type { EmojiItem as ServerEmoji } from "@/types/post";
import { MessageTimestamp } from "@/components/chat/message-timestamp";
import { navigateToProfile } from "@/utils/profile-nav";
import type { EmojiItem } from "@/utils/emojis";
import {
  getEmojiTextMap,
  isSingleEmojiText,
  singleEmojiCode,
} from "@/utils/emojis";
import {
  charOf,
  mergeReactions,
  type ReactionAnchor,
} from "@/utils/reactions";
import { extractVideoUrls } from "@/utils/videoLink";

interface Props {
  message: ChatMessage;
  isMine: boolean;
  /** true = hiện timestamp HH:mm dưới bubble (tin đầu nhóm / cách >60s). */
  showTime?: boolean;
  isPinned?: boolean;
  /** Avatar của đối phương (chỉ dùng cho tin của họ). */
  avatarUri?: string | null;
  /** true = tin đầu chuỗi → hiện avatar; false = hiện spacer để giữ căn lề. */
  showAvatar?: boolean;
  /** Tên người gửi — chỉ hiển thị trong group chat (tin đầu chuỗi, của người khác). */
  senderName?: string | null;
  /** true = đối phương đã đọc tin mình gửi → nhãn "Đã xem" (A1). */
  seen?: boolean;
  /** Group chat: dùng nhãn "Đã xem" + accessibilityLabel kèm tên người xem. */
  isGroup?: boolean;
  /** user_id → tên thành viên (group) — chỉ dùng cho accessibilityLabel seenBy. */
  memberNames?: Record<string, string>;
  /** true = nhấp nháy highlight khi nhảy tới từ kết quả tìm kiếm (B5). */
  highlight?: boolean;
  /** Emoji server theo id — render sticker (emoji_id) + badge cảm xúc. */
  emojis?: Map<string, ServerEmoji> | null;
  myUserId?: string;
  onLongPress?: (msg: ChatMessage) => void;
  onReplyPress?: (messageId: string) => void;
  onMediaPress?: (msg: ChatMessage) => void;
  onOpenPost?: (postId: string) => void;
  /** Tap thả emoji (code `:heart:`…) — screen map sang emoji_id server rồi gửi WS. */
  onReact?: (messageId: string, emojiKey: string) => void;
  /** Long-press quick-heart → mở pill chọn cảm xúc (anchor = rect bubble). */
  onOpenReactionBar?: (msg: ChatMessage, anchor: ReactionAnchor) => void;
  /** Tap vùng badge cảm xúc → mở modal chi tiết. */
  onOpenReactionDetails?: (msg: ChatMessage) => void;
  /** busyBg (Web): nền preset/custom là ảnh bận → armor: bubble bên nhận thêm
   *  viền + shadow, text tin mình thêm text-shadow (giữ brand, thêm tách lớp). */
  busyBg?: boolean;
}

export function ChatBubble({
  message,
  isMine,
  showTime = true,
  isPinned,
  avatarUri,
  showAvatar = false,
  senderName,
  seen = false,
  isGroup = false,
  memberNames,
  highlight = false,
  emojis,
  myUserId,
  onLongPress,
  onReplyPress,
  onMediaPress,
  onOpenPost,
  onReact,
  onOpenReactionBar,
  onOpenReactionDetails,
  busyBg = false,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const emojiMap = useMemo(() => getEmojiTextMap(), []);
  // Reaction local: gộp server + override của mình → render badge cảm xúc.
  const mergedReactions = useMemo(
    () => mergeReactions(message, myUserId, emojis),
    [message, myUserId, emojis],
  );
  // Reaction ĐẦU TIÊN tin nhận được — QuickHeart hiển thị emoji đó
  // (server trả theo created_at).
  const firstReactionChar = useMemo(() => {
    const first = message.reactions?.[0];
    return first ? charOf(first.emoji_id, emojis) : null;
  }, [message.reactions, emojis]);
  // Đo bubble + badge → margin âm cho badge tràn mép trái khi dài hơn bubble.
  const [bubbleW, setBubbleW] = useState(0);
  const [badgeW, setBadgeW] = useState(0);
  // Neo pill reaction: đo rect bubble thật qua measureInWindow.
  const bubbleRef = useRef<View>(null);
  const openReactionBar = () => {
    if (!onOpenReactionBar) return;
    bubbleRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) onOpenReactionBar(message, { x, y, w, h });
    });
  };

  // Cột avatar của đối phương: avatar ở tin đầu chuỗi, spacer (cùng bề rộng) cho các tin sau.
  // Bấm avatar → hồ sơ người gửi (bỏ qua tin ẩn danh).
  const avatarColumn = !isMine ? (
    showAvatar && avatarUri ? (
      <Pressable
        hitSlop={4}
        disabled={message.is_anonymized}
        onPress={() => navigateToProfile(router, message.sender_id)}>
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatar}
          contentFit="cover"
        />
      </Pressable>
    ) : (
      <View style={styles.avatarSpacer} />
    )
  ) : null;

  // Trạng thái gửi/đã xem — nhãn chữ mirror Web SeenIndicator.
  const seenByNames = (message.seen_by ?? []).filter(
    (uid) => uid !== myUserId,
  );
  const showingSeen = isMine && seen;
  const pendingStatus =
    isMine && !message.failed && (message.sending || message.uploading);
  const statusText = pendingStatus
    ? t("chat.sending")
    : showingSeen
      ? t("chat.seen")
      : t("chat.sent");
  // Web: group hiện tên người xem qua tooltip; mobile dùng accessibilityLabel.
  const statusLabel =
    isGroup && showingSeen
      ? t("chat.seenBy", {
          names: seenByNames
            .slice(0, 3)
            .map((uid) => memberNames?.[uid] ?? t("chat.unknown"))
            .join(", "),
        })
      : statusText;

  if (message.deleted) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        {avatarColumn}
        <View style={styles.bubbleCol}>
          <View
            style={[
              styles.bubble,
              styles.bubbleDeleted,
              { backgroundColor: theme.bgSecondary },
            ]}>
            <ThemedText themeColor="textSecondary" style={styles.deletedText}>
              {t("chat.messageDeleted")}
            </ThemedText>
          </View>
          {showTime && (
            <MessageTimestamp createdAt={message.created_at} isMine={isMine} />
          )}
        </View>
      </View>
    );
  }

  if (message.decrypt_failed) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        {avatarColumn}
        <View style={styles.bubbleCol}>
          <View style={[styles.bubble, { backgroundColor: theme.bgSecondary }]}>
            <ThemedText themeColor="textSecondary" style={styles.deletedText}>
              {t("chat.undecryptable")}
            </ThemedText>
          </View>
          {showTime && (
            <MessageTimestamp createdAt={message.created_at} isMine={isMine} />
          )}
        </View>
      </View>
    );
  }

  const isSharedPost =
    !!message.shared_post_id || message.type === "shared_post";
  const videoUrls =
    !isSharedPost && message.content ? extractVideoUrls(message.content) : [];
  const isSingleVideo =
    videoUrls.length === 1 && videoUrls[0] === message.content?.trim();

  // B3: sticker = tin có emoji_id, không media/caption → render ảnh emoji lớn.
  const isSticker =
    !isSharedPost &&
    !message.deleted &&
    !message.media_id &&
    !message.media_uri &&
    !message.content &&
    !!message.emoji_id;
  const stickerEmoji = isSticker
    ? (emojis?.get(message.emoji_id!) ?? null)
    : null;

  const bgColor = isMine ? theme.primary : theme.card;
  const textColor = isMine ? theme.textOnPrimary : theme.text;
  const singleEmoji = isSharedPost
    ? null
    : singleEmojiCode(message.content, emojiMap);
  const singleUnicode =
    !singleEmoji && !isSharedPost && isSingleEmojiText(message.content);
  const singleEmojiUrl =
    !singleEmoji &&
    !singleUnicode &&
    !isSharedPost &&
    isSingleEmojifyiUrl(message.content);
  const singleGiphy =
    !singleEmoji &&
    !singleUnicode &&
    !singleEmojiUrl &&
    !isSharedPost &&
    isSingleGiphyUrl(separateGiphyUrls(message.content));
  const transparentBubble =
    isSticker ||
    (!isSharedPost &&
      (singleEmoji || singleUnicode || singleEmojiUrl || singleGiphy));
  // Media thuần (không caption, không thoại), video preview 1 link, gif đơn
  // -> không khung bọc (cả bg lẫn padding). Có reply/forward (chữ trắng mờ)
  // thì vẫn giữ khung để đọc được.
  const hasCaption = !!message.content?.trim();
  const isVoice = message.media_type?.startsWith('audio/') ?? false;
  const mediaOnly =
    !isSharedPost &&
    (!!message.media_id || !!message.media_uri) &&
    !hasCaption &&
    !isVoice;
  const noFrameBare = mediaOnly || isSingleVideo || singleGiphy;
  const noFrame = noFrameBare && !message.reply_to && !message.forwarded_from;
  // Nền trong suốt: các case transparent cũ (sticker/emoji/gif) + case không khung.
  const bareBg = transparentBubble || noFrame;
  // B5: highlight nhảy tới từ kết quả tìm kiếm — đổi nền để mắt dễ bắt.
  const pressedBg = highlight ? theme.primaryLight : null;

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      {avatarColumn}
      <View style={styles.bubbleCol}>
        {!isMine && showAvatar && !!senderName && (
          <ThemedText
            style={[styles.senderName, { color: theme.textSecondary }]}
            numberOfLines={1}>
            {senderName}
          </ThemedText>
        )}
        <Pressable
        ref={bubbleRef}
        onLayout={(e) => setBubbleW(e.nativeEvent.layout.width)}
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={400}
        style={[
          styles.bubble,
          {
            backgroundColor: pressedBg ?? (bareBg ? "transparent" : bgColor),
            borderBottomRightRadius: isMine ? Radius.sm : Radius.lg,
            borderBottomLeftRadius: isMine ? Radius.lg : Radius.sm,
          },
          noFrame && styles.bubbleNoFrame,
          // busyBg armor (Web .busyBg .theirs .bubble): viền + shadow-md.
          busyBg &&
            !isMine && {
              borderWidth: 1,
              borderColor: theme.textSecondary,
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            },
        ]}>
        {/* Reply snippet */}
        {message.reply_to && (
          <Pressable
            onPress={() => onReplyPress?.(message.reply_to!.id)}
            style={[
              styles.replySnippet,
              {
                borderLeftColor: isMine
                  ? "rgba(255,255,255,0.5)"
                  : theme.primary,
              },
            ]}>
            <ThemedText
              style={[
                styles.replyName,
                { color: isMine ? "rgba(255,255,255,0.8)" : theme.primary },
              ]}
              numberOfLines={1}>
              {message.reply_to.sender_name || t("chat.unknown")}
            </ThemedText>
            <ThemedText
              style={[
                styles.replyText,
                {
                  color: isMine ? "rgba(255,255,255,0.6)" : theme.textSecondary,
                },
              ]}
              numberOfLines={1}>
              {message.reply_to.decrypt_failed
                ? t("chat.undecryptable")
                : message.reply_to.decrypting
                  ? t("chat.decrypting")
                  : message.reply_to.content || t("chat.attachment")}
            </ThemedText>
          </Pressable>
        )}

        {/* Content */}
        {isSharedPost ? (
          <SharedPostBubble
            message={message}
            isMine={isMine}
            onOpenPost={onOpenPost}
            onLongPress={() => onLongPress?.(message)}
          />
        ) : (
          <>
            {isSticker ? (
              stickerEmoji ? (
                <Text style={styles.stickerEmoji}>
                  {stickerEmoji.character || stickerEmoji.code}
                </Text>
              ) : emojis ? (
                // Đã load danh sách emoji nhưng không tìm thấy id → báo hết hạn.
                <ThemedText themeColor="textSecondary" style={styles.deletedText}>
                  {t("chat.emojiUnavailable")}
                </ThemedText>
              ) : null
            ) : singleEmoji ? (
              <EmojiImage emoji={emojiMap.get(singleEmoji)!} size={64} />
            ) : singleUnicode ? (
              <ThemedText style={{ fontSize: 64, lineHeight: 76 }}>
                {message.content.trim()}
                {/* {message.content.trim()} */}
              </ThemedText>
            ) : singleEmojiUrl ? (
              <Image
                source={{ uri: message.content.trim() }}
                style={styles.singleGiphy}
                contentFit="contain"
                transition={200}
              />
            ) : singleGiphy ? (
              <Image
                source={{ uri: giphyStillUrl(message.content.trim()) }}
                style={styles.singleGiphy}
                contentFit="contain"
                transition={200}
              />
            ) : message.media_id || message.media_uri ? (
              <MessageMedia
                message={message}
                isMine={isMine}
                onPress={() => onMediaPress?.(message)}
              />
            ) : isSingleVideo ? (
              <VideoLinkPreview url={videoUrls[0]} />
            ) : (
              <MessageText
                content={message.content}
                emojiMap={emojiMap}
                color={textColor}
                textShadow={busyBg && isMine}
              />
            )}

            {/* Caption below media */}
            {!transparentBubble &&
            (message.media_id || message.media_uri) &&
            message.content?.trim() ? (
              <MessageText
                content={message.content}
                emojiMap={emojiMap}
                color={textColor}
                textShadow={busyBg && isMine}
              />
            ) : null}

            {/* Video link previews (nội dung có nhiều URL video / xen text) */}
            {videoUrls.length > 0 && !isSingleVideo ? (
              <View style={styles.videoStack}>
                {videoUrls.map((vUrl) => (
                  <VideoLinkPreview key={vUrl} url={vUrl} />
                ))}
              </View>
            ) : null}
          </>
        )}

        {/* B1: badge đã chuyển tiếp */}
        {!message.deleted &&
        !message.decrypt_failed &&
        message.forwarded_from ? (
          <View style={styles.metaRow}>
            <ThemedText
              style={[
                styles.forwardBadge,
                {
                  color: isMine ? "rgba(255,255,255,0.8)" : theme.textSecondary,
                },
              ]}>
              <Icon name="share" size={10} /> {t("chat.forwarded")}
            </ThemedText>
          </View>
        ) : null}

        {/* A1/A2: nhãn trạng thái chữ (Đang gửi… / Đã gửi / Đã xem) + pin/lỗi */}
        {isPinned || isMine ? (
          <View style={styles.timeRow}>
            {isPinned && (
              <Icon
                name="pin"
                size={10}
                color={isMine ? "rgba(255,255,255,0.7)" : theme.textSecondary}
              />
            )}
            {isMine && message.failed ? (
              <View style={styles.failedRow}>
                <Icon name="warning" size={11} color={theme.danger} />
                <ThemedText style={[styles.failedText, { color: theme.danger }]}>
                  {t("chat.sendFailed")}
                </ThemedText>
              </View>
            ) : isMine ? (
              <ThemedText
                accessibilityLabel={statusLabel}
                style={[
                  styles.statusText,
                  {
                    // bareBg: xám thay vì trắng 70% (trắng biến mất trên nền chat nhạt).
                    color: bareBg
                      ? theme.textSecondary
                      : showingSeen
                        ? "#A5F3FC"
                        : "rgba(255,255,255,0.7)",
                  },
                ]}>
                {statusText}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {/* A: nút thả nhanh — neo ngoài góc phải-dưới, chỉ tin ĐỐI PHƯƠNG.
            0 reaction → heart outline; có → emoji reaction đầu tiên.
            Tap → thả emoji đang hiện; long-press → rung nhẹ + mở pill. */}
        {!isMine && !message.failed && !message.sending && onReact && (
          <QuickHeart
            reactionChar={firstReactionChar}
            onPress={(code) => onReact(message.id, code)}
            onLongPress={openReactionBar}
          />
        )}
      </Pressable>
      {/* A: badge cảm xúc — góc dưới-trái; nội dung dài hơn bubble → tràn mép trái. */}
      {!message.deleted && !message.decrypt_failed && onOpenReactionDetails && (
        <ReactionBadges
          reactions={mergedReactions}
          onPress={() => onOpenReactionDetails(message)}
          onLayout={setBadgeW}
          style={{ marginLeft: Math.min(0, bubbleW - badgeW) }}
        />
      )}
      {/* Timestamp HH:mm dưới bubble (tin đầu nhóm / cách >60s) — mirror Web */}
      {showTime && (
        <MessageTimestamp createdAt={message.created_at} isMine={isMine} />
      )}
      </View>
    </View>
  );
}

function MessageText({
  content,
  emojiMap,
  color,
  textShadow = false,
}: {
  content: string;
  emojiMap: Map<string, EmojiItem>;
  color: string;
  /** busyBg armor (Web .busyBg .mine .msgText): text-shadow nhẹ trên ảnh nền. */
  textShadow?: boolean;
}) {
  const router = useRouter();
  return (
    <RichContent
      content={content}
      emojiMap={emojiMap}
      size={18}
      onHashtagPress={(tag) =>
        (router as any).push(`/(drawer)/hashtag/${encodeURIComponent(tag)}`)
      }
      hashtagStyle={styles.hashtag}
      style={[
        styles.content,
        { color },
        textShadow && {
          textShadowColor: "rgba(0,0,0,0.25)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 2,
    paddingHorizontal: Spacing.md,
    gap: 6,
  },
  rowMine: {
    justifyContent: "flex-end",
  },
  rowTheirs: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 2,
  },
  avatarSpacer: {
    width: 28,
    height: 1,
  },
  bubble: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    gap: 2,
  },
  bubbleCol: {
    maxWidth: "70%",
    flexShrink: 1,
  },
  senderName: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 12,
    marginBottom: 2,
  },
  bubbleDeleted: {
    opacity: 0.6,
  },
  bubbleNoFrame: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  replySnippet: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 4,
    gap: 1,
  },
  replyName: {
    fontSize: 12,
    fontWeight: "600",
  },
  replyText: {
    fontSize: 12,
  },
  content: {
    ...Typography.body,
    fontSize: 15,
  },
  hashtag: {
    fontWeight: "600",
  },
  singleGiphy: {
    width: 64,
    height: 64,
  },
  videoStack: {
    gap: 4,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  forwardBadge: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "600",
  },
  statusText: {
    fontSize: 10,
    lineHeight: 12,
  },
  failedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  failedText: {
    ...Typography.caption,
    fontSize: 10,
  },
    stickerEmoji: {
      fontSize: 64,
      lineHeight: 72,
      height: 72,
      textAlign: "center",
    },
  deletedText: {
    ...Typography.caption,
    fontStyle: "italic",
  },
});
