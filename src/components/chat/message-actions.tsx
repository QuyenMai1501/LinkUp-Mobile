import { Image } from 'expo-image';
import { Clipboard, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Colors } from '@/constants/colors';
import { useThemeMode } from '@/contexts/theme-context';
import { useServerEmojis, quickReactEmojis } from '@/hooks/use-server-emojis';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage | null;
  myUserId: string;
  isPinned?: boolean;
  canPin?: boolean;
  onClose: () => void;
  onReply: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
  onPin?: (msg: ChatMessage) => void;
  onUnpin?: (msg: ChatMessage) => void;
  /** B2: toggle reaction nhanh từ toolbar. */
  onReact?: (messageId: string, emojiId: string) => void;
  /** B1: mở picker chọn hội thoại để chuyển tiếp. */
  onForward?: (msg: ChatMessage) => void;
  /** A2: gửi lại tin thất bại. */
  onRetry?: (msg: ChatMessage) => void;
  /** A2: bỏ tin thất bại. */
  onDiscard?: (msg: ChatMessage) => void;
}

export function MessageActions({
  message,
  myUserId,
  isPinned,
  canPin,
  onClose,
  onReply,
  onDelete,
  onPin,
  onUnpin,
  onReact,
  onForward,
  onRetry,
  onDiscard,
}: Props) {
  const { t } = useTranslation();
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const { byCode } = useServerEmojis();

  if (!message) return null;

  const isMine = message.sender_id === myUserId;
  const canDelete = true;
  const canDeleteForAll = isMine && !message.deleted;
  const isFailed = !!message.failed;
  const isBlocked = message.deleted || message.decrypt_failed;
  // Chỉ chuyển tiếp được tin có nội dung text/emoji (media giữ nguyên media —
  // mobile không gửi lại media trong forward).
  const canForward = !isBlocked && !isFailed && !!(message.content?.trim() || message.emoji_id);
  const quickEmojis =
    isBlocked || isFailed || !onReact ? [] : quickReactEmojis(byCode);

  return (
    <Modal visible={!!message} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}>
          {/* A2: tin gửi thất bại → retry /discard thay cho menu thường */}
          {isFailed && (
            <>
              <Pressable
                style={[styles.action, { borderBottomColor: colors.border }]}
                onPress={() => {
                  onRetry?.(message);
                  onClose();
                }}>
                <Icon name="refresh" size={18} color={colors.primary} />
                <ThemedText style={[styles.actionLabel, { color: colors.primary }]}>
                  {t('chat.retry')}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.action, { borderBottomColor: colors.border }]}
                onPress={() => {
                  onDiscard?.(message);
                  onClose();
                }}>
                <Icon name="close" size={18} color={colors.danger} />
                <ThemedText style={[styles.actionLabel, { color: colors.danger }]}>
                  {t('chat.discard')}
                </ThemedText>
              </Pressable>
            </>
          )}

          {/* B2: hàng reaction nhanh (8 emoji như Web MessageToolbar) */}
          {quickEmojis.length > 0 && (
            <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {quickEmojis.map((emoji) => (
                  <Pressable
                    key={emoji.id}
                    style={styles.quickEmoji}
                    onPress={() => {
                      onReact?.(message.id, emoji.id);
                      onClose();
                    }}>
                    <Image
                      source={{ uri: emoji.image_uri }}
                      style={styles.quickEmojiImg}
                      contentFit="contain"
                      transition={150}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {!message.deleted && !isFailed && (
            <>
              <Pressable
                style={[styles.action, { borderBottomColor: colors.border }]}
                onPress={() => {
                  onReply(message);
                  onClose();
                }}>
                <Icon name="reply" size={18} color={colors.text} />
                <ThemedText style={[styles.actionLabel, { color: colors.text }]}>{t('chat.reply')}</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.action, { borderBottomColor: colors.border }]}
                onPress={() => {
                  Clipboard.setString(message.content);
                  onClose();
                }}>
                <Icon name="copy" size={18} color={colors.text} />
                <ThemedText style={[styles.actionLabel, { color: colors.text }]}>{t('chat.copy')}</ThemedText>
              </Pressable>

              {/* B1: chuyển tiếp */}
              {canForward && onForward && (
                <Pressable
                  style={[styles.action, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    onForward(message);
                    onClose();
                  }}>
                  <Icon name="share" size={18} color={colors.text} />
                  <ThemedText style={[styles.actionLabel, { color: colors.text }]}>
                    {t('chat.forward')}
                  </ThemedText>
                </Pressable>
              )}

              {isPinned ? (
                <Pressable
                  style={[styles.action, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    onUnpin?.(message);
                    onClose();
                  }}>
                  <Icon name="pin" size={18} color={colors.text} />
                  <ThemedText style={[styles.actionLabel, { color: colors.text }]}>{t('chat.unpinMessage')}</ThemedText>
                </Pressable>
              ) : canPin ? (
                <Pressable
                  style={[styles.action, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    onPin?.(message);
                    onClose();
                  }}>
                  <Icon name="pin" size={18} color={colors.text} />
                  <ThemedText style={[styles.actionLabel, { color: colors.text }]}>{t('chat.pinMessage')}</ThemedText>
                </Pressable>
              ) : null}
            </>
          )}

          {canDelete && (
            <Pressable
              style={[styles.action, { borderBottomColor: colors.border }]}
              onPress={() => {
                onDelete(message);
                onClose();
              }}>
              <Icon name="trash" size={18} color={colors.danger} />
              <ThemedText style={[styles.actionLabel, { color: colors.danger }]}>
                {t('chat.deleteForMe')}
              </ThemedText>
            </Pressable>
          )}

          {canDeleteForAll && (
            <Pressable
              style={styles.action}
              onPress={() => {
                onDelete(message);
                onClose();
              }}>
              <Icon name="trash" size={18} color={colors.danger} />
              <ThemedText style={[styles.actionLabel, { color: colors.danger }]}>
                {t('chat.deleteForAll')}
              </ThemedText>
            </Pressable>
          )}

          <Pressable
            style={[styles.action, styles.cancelAction, { borderTopColor: colors.border }]}
            onPress={onClose}>
            <ThemedText style={[styles.actionLabel, { color: colors.textSecondary, fontWeight: '600' }]}>
              {t('common.cancel')}
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quickRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quickEmoji: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  quickEmojiImg: {
    width: 26,
    height: 26,
  },
  actionLabel: {
    fontSize: 15,
  },
  cancelAction: {
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
});
