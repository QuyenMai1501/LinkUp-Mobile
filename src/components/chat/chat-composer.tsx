import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { EmojiPicker } from '@/components/emoji-picker';
import { GiphyGifPicker } from '@/components/giphy-gif-picker';
import { VoicePlayer, formatAudioTime } from '@/components/chat/voice-player';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useVoiceRecorder, type VoiceRecording } from '@/hooks/use-voice-recorder';
import type { GiphyGif } from '@/api/giphy';
import type { EmojiOption } from '@/api/emojifyi';
import type { ChatMessage } from '@/types/chat';

const MAX_ATTACHMENTS = 10;

export interface AttachmentItem {
  uri: string;
  name: string;
  type: string;
}

interface Props {
  onSend: (text: string, attachments?: AttachmentItem[], gifUrl?: string) => void;
  /** Gửi tin nhắn thoại đã ghi (file local + thời lượng giây). */
  onSendVoice: (
    file: { uri: string; name: string; type: string },
    durationSec: number,
  ) => void;
  onTyping: (isTyping: boolean) => void;
  replyingTo?: ChatMessage | null;
  /** Tên người nhắn đã được màn chat resolve (sender_name server luôn rỗng
   *  với chat 1-1) — "Bạn" cho tin của mình, tên partner cho tin đối phương. */
  replySenderLabel?: string;
  onClearReply?: () => void;
  /** B1: draft chuyển tiếp — prefill nội dung + hiện bar "Đang chuyển tiếp". */
  forwarding?: { content: string; emojiId?: string } | null;
  onClearForward?: () => void;
}

export function ChatComposer({
  onSend,
  onSendVoice,
  onTyping,
  replyingTo,
  replySenderLabel,
  onClearReply,
  forwarding,
  onClearForward,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const inputRef = useRef<TextInput>(null);

  // —— Tin nhắn thoại ——
  const voice = useVoiceRecorder();
  const [voicePreview, setVoicePreview] = useState<VoiceRecording | null>(null);

  // B1: nhận draft → prefill nội dung gốc (reference ổn định từ state cha).
  // setState sau await — tránh react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (forwarding) setText(forwarding.content);
    })();
    return () => {
      cancelled = true;
    };
  }, [forwarding]);

  // Sticker chuyển tiếp (emoji_id, không text) vẫn cho phép gửi.
  const forwardStickerReady = !!forwarding?.emojiId && !text.trim();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0 && !forwardStickerReady) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setText('');
    setAttachments([]);
    onTyping(false);
  };

  const handleChangeText = (value: string) => {
    setText(value);
    onTyping(value.length > 0);
  };

  // Chèn ký tự emoji unicode — TextInput hiển thị trực tiếp, nối tiếp được nhiều emoji.
  const handleEmojiSelect = (emoji: EmojiOption) => {
    setText((prev) => prev + emoji.character);
    onTyping(true);
  };

  // Chọn GIF -> gửi ngay (giống web), GIF gửi dưới dạng gif_url.
  const handleGifSelect = (gif: GiphyGif) => {
    onSend('', undefined, gif.preview);
    onTyping(false);
  };

  // Mic chỉ hiện khi ô nhập trống (đổi vai trò với nút gửi).
  const canRecordVoice = !text.trim() && attachments.length === 0 && !forwardStickerReady;

  const handleMicPress = () => {
    setEmojiOpen(false);
    setGifOpen(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
    void (async () => {
      const started = await voice.start();
      if (!started) Alert.alert(t('common.error'), t('call.permissionDenied'));
    })();
  };

  const handleStopRecording = () => {
    void (async () => {
      const rec = await voice.stop();
      if (rec) setVoicePreview(rec);
    })();
  };

  const handleCancelRecording = () => {
    setVoicePreview(null);
    void voice.cancel();
  };

  const handleSendVoice = () => {
    if (!voicePreview) return;
    const last = voicePreview.uri.split('/').pop() ?? '';
    const ext = (last.includes('.') ? (last.split('.').pop() ?? 'm4a') : 'm4a').toLowerCase();
    onSendVoice(
      { uri: voicePreview.uri, name: `voice.${ext}`, type: `audio/${ext}` },
      voicePreview.durationSec,
    );
    setVoicePreview(null);
  };

  // Tự dừng khi chạm giới hạn 5 phút (server chặn audio > 300s).
  useEffect(() => {
    if (voice.recording && voice.maxReached) handleStopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.recording, voice.maxReached]);

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
                {replySenderLabel || replyingTo.sender_name || t('chat.unknown')}
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

      {/* B1: forward bar */}
      {forwarding && (
        <View
          style={[
            styles.replyBar,
            { backgroundColor: theme.bgSecondary, borderLeftColor: theme.primary },
          ]}>
          <View style={styles.replyContent}>
            <View style={styles.replyLabel}>
              <Icon name="share" size={12} color={theme.textSecondary} />
              <ThemedText
                style={[styles.replyName, { color: theme.primary }]}
                numberOfLines={1}>
                {t('chat.forwarding')}
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.replySnippet, { color: theme.textSecondary }]}
              numberOfLines={1}>
              {forwarding.content || t('chat.attachment')}
            </ThemedText>
          </View>
          <Pressable onPress={onClearForward} hitSlop={8} style={styles.replyCancel}>
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

      {/* Emoji panel inline — trên ô nhập, không che composer */}
      {emojiOpen && (
        <EmojiPicker onClose={() => setEmojiOpen(false)} onSelect={handleEmojiSelect} />
      )}

      {/* Đang ghi âm — thay ô nhập */}
      {voice.recording ? (
        <View
          style={[
            styles.recordBar,
            { backgroundColor: theme.bgSecondary, borderColor: theme.border },
          ]}>
          <View style={[styles.recDot, { backgroundColor: theme.danger }]} />
          <ThemedText style={[styles.recTime, { color: theme.text }]}>
            {t('chat.recording')} {formatAudioTime(voice.elapsedSec)}
          </ThemedText>
          <View style={styles.barSpacer} />
          <Pressable onPress={handleCancelRecording} hitSlop={8} style={styles.barAction}>
            <Icon name="close" size={22} color={theme.textSecondary} />
          </Pressable>
          <Pressable
            onPress={handleStopRecording}
            style={[styles.barAction, { backgroundColor: theme.primary }]}>
            <Icon name="stop" size={18} color="#FFF" />
          </Pressable>
        </View>
      ) : voicePreview ? (
        /* Đã ghi xong — nghe lại trước khi gửi */
        <View style={styles.previewRow}>
          <VoicePlayer
            uri={voicePreview.uri}
            durationSeconds={voicePreview.durationSec}
            style={styles.previewPlayer}
          />
          <View style={styles.barSpacer} />
          <Pressable
            onPress={() => setVoicePreview(null)}
            hitSlop={8}
            style={styles.barAction}>
            <Icon name="close" size={22} color={theme.textSecondary} />
          </Pressable>
          <Pressable
            onPress={handleSendVoice}
            style={[styles.barAction, { backgroundColor: theme.primary }]}>
            <Icon name="sendFilled" size={18} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputRow}>
          {/* Attachment button */}
          <Pressable
            onPress={handlePickImage}
            style={styles.emojiBtn}>
            <Icon name="attach" size={20} color={theme.textSecondary} />
          </Pressable>

          {/* Emoji button — mở panel inline phía trên ô nhập (bàn phím tắt trước) */}
          <Pressable
            onPress={() => {
              setGifOpen(false);
              inputRef.current?.blur();
              Keyboard.dismiss();
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
            ref={inputRef}
            style={[styles.input, { color: theme.text, backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
            value={text}
            onChangeText={handleChangeText}
            onFocus={() => setEmojiOpen(false)}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2000}
          />
          {canRecordVoice ? (
            /* Ô nhập trống → mic ghi âm (giống WhatsApp/Telegram) */
            <Pressable
              onPress={handleMicPress}
              accessibilityLabel={t('chat.voiceMessage')}
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Icon name="mic" size={20} color="#FFF" />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor:
                    text.trim() || attachments.length > 0 || forwardStickerReady
                      ? theme.primary
                      : theme.bgSecondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              disabled={!text.trim() && attachments.length === 0 && !forwardStickerReady}>
              <View>
                <View
                  style={[
                    styles.sendIcon,
                    {
                      borderColor:
                        text.trim() || attachments.length > 0 || forwardStickerReady
                          ? '#FFF'
                          : theme.textSecondary,
                    },
                  ]}
                />
              </View>
            </Pressable>
          )}
        </View>
      )}

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
  recordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recTime: {
    ...Typography.body,
    fontSize: 13,
    flexShrink: 1,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  previewPlayer: {
    width: 160,
  },
  barSpacer: {
    flex: 1,
  },
  barAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
