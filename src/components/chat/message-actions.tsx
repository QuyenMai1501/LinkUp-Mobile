import { Clipboard, Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/colors';
import { useThemeMode } from '@/contexts/theme-context';
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
}

export function MessageActions({ message, myUserId, isPinned, canPin, onClose, onReply, onDelete, onPin, onUnpin }: Props) {
  const { t } = useTranslation();
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];

  if (!message) return null;

  const isMine = message.sender_id === myUserId;
  const canDelete = true;
  const canDeleteForAll = isMine && !message.deleted;

  return (
    <Modal visible={!!message} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}>
          {!message.deleted && (
            <>
              <Pressable
                style={[styles.action, { borderBottomColor: colors.border }]}
                onPress={() => {
                  onReply(message);
                  onClose();
                }}>
                <ThemedText style={styles.actionIcon}>↩️</ThemedText>
                <ThemedText style={[styles.actionLabel, { color: colors.text }]}>{t('chat.reply')}</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.action, { borderBottomColor: colors.border }]}
                onPress={() => {
                  Clipboard.setString(message.content);
                  onClose();
                }}>
                <ThemedText style={styles.actionIcon}>📋</ThemedText>
                <ThemedText style={[styles.actionLabel, { color: colors.text }]}>{t('chat.copy')}</ThemedText>
              </Pressable>

              {isPinned ? (
                <Pressable
                  style={[styles.action, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    onUnpin?.(message);
                    onClose();
                  }}>
                  <ThemedText style={styles.actionIcon}>📌</ThemedText>
                  <ThemedText style={[styles.actionLabel, { color: colors.text }]}>{t('chat.unpinMessage')}</ThemedText>
                </Pressable>
              ) : canPin ? (
                <Pressable
                  style={[styles.action, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    onPin?.(message);
                    onClose();
                  }}>
                  <ThemedText style={styles.actionIcon}>📌</ThemedText>
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
              <ThemedText style={styles.actionIcon}>🗑️</ThemedText>
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
              <ThemedText style={styles.actionIcon}>🗑️</ThemedText>
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
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    fontSize: 15,
  },
  cancelAction: {
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
});
