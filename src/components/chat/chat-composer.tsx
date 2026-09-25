import { useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { GiphyEmojiPicker } from '@/components/giphy-emoji-picker';
import { GiphyGifPicker } from '@/components/giphy-gif-picker';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { GiphyGif } from '@/api/giphy';
import type { ChatMessage } from '@/types/chat';

const MAX_ATTACHMENTS = 10;

export interface AttachmentItem {
  uri: string;
  name: string;
  type: string;
}

interface Props {
  onSend: (text: string, attachments?: AttachmentItem[], gifUrl?: string) => void;
  onTyping: (isTyping: boolean) => void;
  replyingTo?: ChatMessage | null;
  onClearReply?: () => void;
}

export function ChatComposer({ onSend, onTyping, replyingTo, onClearReply }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setText('');
    setAttachments([]);
    onTyping(false);
  };

  const handleChangeText = (value: string) => {
    setText(value);
    onTyping(value.length > 0);
  };

  const handleEmojiSelect = (url: string) => {
    // Bọc URL bằng space — 2 emoji liền nhau không separator sẽ render thành 1 ảnh.
    setText((prev) => {
      const sep = prev && !/\s$/.test(prev) ? ' ' : '';
      return `${prev}${sep}${url} `;
    });
  };

  // Chọn GIF -> gửi ngay (giống web), GIF gửi dưới dạng gif_url.
  const handleGifSelect = (gif: GiphyGif) => {
    onSend('', undefined, gif.preview);
    onTyping(false);
  };

  const handlePickImage = async () => {
    const allowed = MAX_ATTACHMENTS - attachments.length;
    if (allowed <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: allowed,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newAttachments = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop() || 'file',
        type: asset.mimeType || 'image/jpeg',
      }));
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <View style={[styles.container, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
      {/* Reply bar */}
      {replyingTo && (
        <View style={[styles.replyBar, { backgroundColor: theme.bgSecondary, borderLeftColor: theme.primary }]}>
          <View style={styles.replyContent}>
            <View style={styles.replyLabel}>
              <Icon name="reply" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.replyName, { color: theme.primary }]} numberOfLines={1}>
                {replyingTo.sender_name || t('chat.unknown')}
              </ThemedText>
            </View>
            <ThemedText style={[styles.replySnippet, { color: theme.textSecondary }]} numberOfLines={1}>
              {replyingTo.deleted ? t('chat.messageDeleted') : replyingTo.content || t('chat.attachment')}
            </ThemedText>
          </View>
          <Pressable onPress={onClearReply} hitSlop={8} style={styles.replyCancel}>
            <Icon name="close" size={14} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <View style={[styles.attachmentBar, { backgroundColor: theme.bgSecondary }]}>
          {attachments.map((att, index) => (
            <View key={index} style={styles.attachmentThumb}>
              {att.type.startsWith('video/') ? (
                <View style={[styles.videoThumb, { backgroundColor: theme.bg }]}>
                  <Icon name="play" size={20} color={theme.textSecondary} />
                </View>
              ) : (
                <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
              )}
              <Pressable
                style={[styles.attachmentRemove, { backgroundColor: theme.danger }]}
                onPress={() => handleRemoveAttachment(index)}>
                <Icon name="close" size={10} color="#FFF" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inputRow}>
        {/* Attachment button */}
        <Pressable
          onPress={handlePickImage}
          style={styles.emojiBtn}>
          <Icon name="attach" size={20} color={theme.textSecondary} />
        </Pressable>

        {/* Emoji button */}
        <Pressable
          onPress={() => {
            setGifOpen(false);
            setEmojiOpen((prev) => !prev);
          }}
          style={[styles.emojiBtn, emojiOpen && { backgroundColor: theme.bgSecondary }]}>
          <Icon name="smile" size={20} color={theme.textSecondary} />
        </Pressable>

        {/* GIF button */}
        <Pressable
          onPress={() => {
            setEmojiOpen(false);
            setGifOpen((prev) => !prev);
          }}
          accessibilityLabel={t('composer.gif')}
          style={[styles.emojiBtn, gifOpen && { backgroundColor: theme.bgSecondary }]}>
          <Icon name="gif" size={20} color={theme.textSecondary} />
        </Pressable>

        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
          value={text}
          onChangeText={handleChangeText}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: text.trim() || attachments.length > 0 ? theme.primary : theme.bgSecondary,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          disabled={!text.trim() && attachments.length === 0}>
          <View>
            <View style={[styles.sendIcon, { borderColor: text.trim() || attachments.length > 0 ? '#FFF' : theme.textSecondary }]} />
          </View>
        </Pressable>
      </View>

      {/* Emoji picker */}
      <GiphyEmojiPicker visible={emojiOpen} onClose={() => setEmojiOpen(false)} onSelect={handleEmojiSelect} />

      {/* GIF picker */}
      <GiphyGifPicker visible={gifOpen} onClose={() => setGifOpen(false)} onSelect={handleGifSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderLeftWidth: 3,
    gap: Spacing.sm,
  },
  replyContent: {
    flex: 1,
    gap: 2,
  },
  replyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
  },
  replySnippet: {
    fontSize: 12,
  },
  replyCancel: {
    padding: Spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  emojiBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'currentColor',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  attachmentBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  attachmentThumb: {
    width: 60,
    height: 60,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  attachmentImage: {
    width: 60,
    height: 60,
  },
  videoThumb: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
