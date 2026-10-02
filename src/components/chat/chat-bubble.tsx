import { Image } from "expo-image";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { isSingleEmojifyiUrl } from "@/api/emojifyi";
import {
  giphyStillUrl,
  isSingleGiphyUrl,
  separateGiphyUrls,
} from "@/api/giphy";
import { EmojiImage } from "@/components/chat/emoji-image";
import { MessageMedia } from "@/components/chat/message-media";
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
import { formatChatTime } from "@/utils/chat";
import type { EmojiItem } from "@/utils/emojis";
import {
  getEmojiTextMap,
  isSingleEmojiText,
  singleEmojiCode,
} from "@/utils/emojis";
import { extractVideoUrls } from "@/utils/videoLink";

interface Props {
  message: ChatMessage;
  isMine: boolean;
  showTime?: boolean;
  isPinned?: boolean;
  /** Avatar của đối phương (chỉ dùng cho tin của họ). */
  avatarUri?: string | null;
  /** true = tin đầu chuỗi → hiện avatar; false = hiện spacer để giữ căn lề. */
  showAvatar?: boolean;
  /** true = đối phương đã đọc tin mình gửi → ✓✓ (A1). */
  seen?: boolean;
  /** true = nhấp nháy highlight khi nhảy tới từ kết quả tìm kiếm (B5). */
  highlight?: boolean;
  /** Emoji server theo id — render sticker (emoji_id) + reaction chip (B2/B3). */
  emojis?: Map<string, ServerEmoji> | null;
  myUserId?: string;
  onLongPress?: (msg: ChatMessage) => void;
  onReplyPress?: (messageId: string) => void;
  onMediaPress?: (msg: ChatMessage) => void;
  onOpenPost?: (postId: string) => void;
  onReact?: (messageId: string, emojiId: string) => void;
}

export function ChatBubble({
  message,
  isMine,
  showTime = true,
  isPinned,
  avatarUri,
  showAvatar = false,
  seen = false,
  highlight = false,
  emojis,
  myUserId,
  onLongPress,
  onReplyPress,
  onMediaPress,
  onOpenPost,
  onReact,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const emojiMap = useMemo(() => getEmojiTextMap(), []);

  // Cột avatar của đối phương: avatar ở tin đầu chuỗi, spacer (cùng bề rộng) cho các tin sau.
  const avatarColumn = !isMine ? (
    showAvatar && avatarUri ? (
      <Image
        source={{ uri: avatarUri }}
        style={styles.avatar}
        contentFit="cover"
      />
    ) : (
      <View style={styles.avatarSpacer} />
    )
  ) : null;

  if (message.deleted) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        {avatarColumn}
        <View
          style={[
            styles.bubble,
            styles.bubbleDeleted,
            { backgroundColor: theme.bgSecondary },
          ]}>
          <ThemedText themeColor="textSecondary" style={styles.deletedText}>
            {t("chat.messageDeleted")}
          </ThemedText>
          {showTime && (
            <ThemedText themeColor="textSecondary" style={styles.time}>
              {formatChatTime(message.created_at, t)}
            </ThemedText>
          )}
        </View>
      </View>
    );
  }

  if (message.decrypt_failed) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        {avatarColumn}
        <View style={[styles.bubble, { backgroundColor: theme.bgSecondary }]}>
          <ThemedText themeColor="textSecondary" style={styles.deletedText}>
            {t("chat.undecryptable")}
          </ThemedText>
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

  // B2: gộp reactions theo emoji_id — emoji mình chọn lên đầu.
  const reactionChips: {
    emojiId: string;
    emoji: ServerEmoji;
    count: number;
    mine: boolean;
  }[] = [];
  if (!message.deleted && !message.decrypt_failed && emojis && onReact) {
    for (const r of message.reactions ?? []) {
      const item = emojis.get(r.emoji_id);
      if (!item) continue;
      const existing = reactionChips.find((c) => c.emojiId === r.emoji_id);
      if (existing) {
        existing.count += 1;
        if (r.user_id === myUserId) existing.mine = true;
      } else {
        reactionChips.push({
          emojiId: r.emoji_id,
          emoji: item,
          count: 1,
          mine: r.user_id === myUserId,
        });
      }
    }
    reactionChips.sort((a, b) => Number(b.mine) - Number(a.mine));
  }

  const bgColor = isMine ? theme.primary : theme.card;
  const textColor = isMine ? "#FFFFFF" : theme.text;
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
  // B5: highlight nhảy tới từ kết quả tìm kiếm — đổi nền để mắt dễ bắt.
  const pressedBg = highlight ? theme.primaryLight : null;

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      {avatarColumn}
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={400}
        style={[
          styles.bubble,
          {
            backgroundColor:
              pressedBg ?? (transparentBubble ? "transparent" : bgColor),
            borderBottomRightRadius: isMine ? Radius.sm : Radius.lg,
            borderBottomLeftRadius: isMine ? Radius.lg : Radius.sm,
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
                <Image
                  source={{ uri: stickerEmoji.image_uri }}
                  style={styles.sticker}
                  contentFit="contain"
                  transition={200}
                />
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
                onPress={() => onMediaPress?.(message)}
              />
            ) : isSingleVideo ? (
              <VideoLinkPreview url={videoUrls[0]} />
            ) : (
              <MessageText
                content={message.content}
                emojiMap={emojiMap}
                color={"#000000"}
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

        {/* B1/B2: badge đã chuyển tiếp + reaction chips */}
        {!message.deleted &&
        !message.decrypt_failed &&
        (message.forwarded_from || reactionChips.length > 0) ? (
          <View style={styles.metaRow}>
            {message.forwarded_from ? (
              <ThemedText
                style={[
                  styles.forwardBadge,
                  {
                    color: isMine ? "rgba(255,255,255,0.8)" : theme.textSecondary,
                  },
                ]}>
                <Icon name="share" size={10} /> {t("chat.forwarded")}
              </ThemedText>
            ) : null}
            {reactionChips.map((chip) => (
              <Pressable
                key={chip.emojiId}
                onPress={() => onReact?.(message.id, chip.emojiId)}
                style={[
                  styles.reactionChip,
                  {
                    backgroundColor: chip.mine
                      ? isMine
                        ? "rgba(255,255,255,0.18)"
                        : theme.primaryLight
                      : theme.bgSecondary,
                    borderColor: chip.mine ? theme.primary : theme.border,
                  },
                ]}>
                <Image
                  source={{ uri: chip.emoji.image_uri }}
                  style={styles.reactionChipEmoji}
                  contentFit="contain"
                />
                {chip.count > 1 && (
                  <ThemedText
                    style={[
                      styles.reactionChipCount,
                      { color: isMine ? "#FFFFFF" : theme.text },
                    ]}>
                    {chip.count}
                  </ThemedText>
                )}
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* A1/A2: time + tick đã gửi/đã đọc + trạng thái gửi thất bại */}
        {showTime || isMine ? (
          <View style={styles.timeRow}>
            {isPinned && (
              <Icon
                name="pin"
                size={10}
                color={isMine ? "rgba(255,255,255,0.7)" : theme.textSecondary}
              />
            )}
            {showTime && (
              <ThemedText
                style={[
                  styles.time,
                  {
                    color: isMine ? "rgba(255,255,255,0.7)" : theme.textSecondary,
                  },
                ]}>
                {formatChatTime(message.created_at, t)}
              </ThemedText>
            )}
            {isMine && message.failed ? (
              <View style={styles.failedRow}>
                <Icon name="warning" size={11} color="#F87171" />
                <ThemedText style={styles.failedText}>
                  {t("chat.sendFailed")}
                </ThemedText>
              </View>
            ) : isMine && !message.sending ? (
              <ThemedText
                style={[
                  styles.tick,
                  {
                    color: transparentBubble
                      ? theme.textSecondary
                      : seen
                        ? "#A5F3FC"
                        : "rgba(255,255,255,0.7)",
                  },
                ]}>
                {seen ? "✓✓" : "✓"}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function MessageText({
  content,
  emojiMap,
  color,
}: {
  content: string;
  emojiMap: Map<string, EmojiItem>;
  color: string;
}) {
  return (
    <RichContent
      content={content}
      emojiMap={emojiMap}
      size={18}
      style={[styles.content, { color }]} 
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
    maxWidth: "78%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    gap: 2,
  },
  bubbleDeleted: {
    opacity: 0.6,
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
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
  },
  reactionChipEmoji: {
    width: 14,
    height: 14,
  },
  reactionChipCount: {
    fontSize: 10,
    fontWeight: "600",
  },
  tick: {
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
    color: "#F87171",
  },
  sticker: {
    width: 72,
    height: 72,
  },
  time: {
    ...Typography.caption,
    fontSize: 10,
    alignSelf: "flex-end",
  },
  deletedText: {
    ...Typography.caption,
    fontStyle: "italic",
  },
});
