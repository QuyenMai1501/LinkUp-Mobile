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
  onLongPress?: (msg: ChatMessage) => void;
  onReplyPress?: (messageId: string) => void;
  onMediaPress?: (msg: ChatMessage) => void;
  onOpenPost?: (postId: string) => void;
}

export function ChatBubble({
  message,
  isMine,
  showTime = true,
  isPinned,
  avatarUri,
  showAvatar = false,
  onLongPress,
  onReplyPress,
  onMediaPress,
  onOpenPost,
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
    !isSharedPost &&
    (singleEmoji || singleUnicode || singleEmojiUrl || singleGiphy);

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      {avatarColumn}
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={400}
        style={[
          styles.bubble,
          {
            backgroundColor: transparentBubble ? "transparent" : bgColor,
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
            {singleEmoji ? (
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

        {showTime && (
          <View style={styles.timeRow}>
            {isPinned && (
              <Icon
                name="pin"
                size={10}
                color={isMine ? "rgba(255,255,255,0.7)" : theme.textSecondary}
              />
            )}
            <ThemedText
              style={[
                styles.time,
                {
                  color: isMine ? "rgba(255,255,255,0.7)" : theme.textSecondary,
                },
              ]}>
              {formatChatTime(message.created_at, t)}
            </ThemedText>
          </View>
        )}
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
