import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { type IconName } from '@/constants/icon-map';
import { GiphyEmojiPicker } from '@/components/giphy-emoji-picker';
import { GiphyGifPicker } from '@/components/giphy-gif-picker';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { getMyProfile } from '@/api/profile';
import { createPost } from '@/api/posts';
import type { GiphyGif } from '@/api/giphy';
import type { PostStatus, FeedPost } from '@/types/post';
import type { ViewProfileResponse } from '@/types/profile';

const CONTENT_MAX = 5000;
const TITLE_MAX = 150;

interface MediaItem {
  uri: string;
  type: string;
  name: string;
}

interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  onPosted: (post: FeedPost) => void;
}

const PRIVACY_OPTIONS: { value: PostStatus; iconName: IconName; labelKey: string }[] = [
  { value: 'public', iconName: 'globe', labelKey: 'composer.privacy.public' },
  { value: 'friend', iconName: 'people', labelKey: 'composer.privacy.friend' },
  { value: 'private', iconName: 'lock', labelKey: 'composer.privacy.private' },
];

export default function PostComposer({ visible, onClose, onPosted }: PostComposerProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [privacy, setPrivacy] = useState<PostStatus>('public');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [gifPickerVisible, setGifPickerVisible] = useState(false);
  const [gif, setGif] = useState<GiphyGif | null>(null);
  const [privacyMenuVisible, setPrivacyMenuVisible] = useState(false);
  const [profile, setProfile] = useState<ViewProfileResponse | null>(null);

  useEffect(() => {
    if (visible) {
      getMyProfile().then(setProfile).catch(() => {});
    }
  }, [visible]);

  const reset = useCallback(() => {
    setTitle('');
    setContent('');
    setPrivacy('public');
    setMedia([]);
    setError(null);
    setEmojiPickerVisible(false);
    setGifPickerVisible(false);
    setGif(null);
    setPrivacyMenuVisible(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMedia((prev) => [...prev, { uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: asset.fileName || `image_${Date.now()}.jpg` }]);
      setError(null);
    }
  };

  const handlePickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMedia((prev) => [...prev, { uri: asset.uri, type: asset.mimeType || 'video/mp4', name: asset.fileName || `video_${Date.now()}.mp4` }]);
      setError(null);
    }
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const insertEmoji = (emoji: string) => {
    // Bọc URL bằng space — 2 emoji liền nhau không separator sẽ render thành 1 ảnh.
    setContent((prev) => {
      const sep = prev && !/\s$/.test(prev) ? ' ' : '';
      return `${prev}${sep}${emoji} `;
    });
    setError(null);
  };

  const handleGifSelect = (selected: GiphyGif) => {
    setGif(selected);
    setError(null);
  };

  const validate = (): string | null => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const hasMedia = media.length > 0 || gif !== null;

    if (trimmedTitle !== '' && (trimmedTitle.length < 5 || trimmedTitle.length > TITLE_MAX)) {
      return t('composer.errorTitleLength');
    }
    if (!hasMedia && trimmedContent === '') {
      return t('composer.errorContentRequired');
    }
    if (content.length > CONTENT_MAX) {
      return t('composer.errorMaxLength');
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    Alert.alert(
      t('composer.confirmTitle'),
      t('composer.confirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('composer.post'), onPress: doSubmit },
      ],
    );
  };

  const doSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await createPost({
        title: title.trim(),
        content: content.trim(),
        status: privacy,
        mediaUris: media,
        gifUrl: gif?.full,
      });
      reset();
      onPosted(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const currentPrivacy = PRIVACY_OPTIONS.find((o) => o.value === privacy) ?? PRIVACY_OPTIONS[0];
  const contentLength = Array.from(content).length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <ThemedView style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.flex}>
          <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
            <Pressable onPress={handleClose} style={styles.headerBtn}>
              <ThemedText themeColor="textSecondary" style={styles.headerBtnText}>
                {t('composer.cancel')}
              </ThemedText>
            </Pressable>
            <ThemedText style={styles.headerTitle}>
              {t('composer.post')}
            </ThemedText>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[styles.headerBtn, styles.submitBtn, { backgroundColor: theme.primary }]}>
              {submitting ? (
                <ThemedText style={styles.submitBtnText}>{t('common.processing')}</ThemedText>
              ) : (
                <ThemedText style={[styles.submitBtnText, { color: '#FFF' }]}>{t('composer.post')}</ThemedText>
              )}
            </Pressable>
          </ThemedView>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {/* Author row */}
              <View style={styles.authorRow}>
                {profile?.avatar_uri ? (
                  <Image source={{ uri: profile.avatar_uri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.bgSecondary }]}>
                    <ThemedText style={styles.avatarInitial}>
                      {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
                    </ThemedText>
                  </View>
                )}
                <ThemedText style={styles.authorName}>
                  {profile?.display_name || '...'}
                </ThemedText>
              </View>

              {/* Title input */}
              <TextInput
                style={[styles.titleInput, { color: theme.text }]}
                value={title}
                onChangeText={(text) => { setTitle(text); setError(null); }}
                maxLength={TITLE_MAX}
                placeholder={t('composer.titlePlaceholder')}
                placeholderTextColor={theme.textSecondary}
              />

              {/* Content input */}
              <TextInput
                style={[styles.contentInput, { color: theme.text }]}
                value={content}
                onChangeText={(text) => { setContent(text); setError(null); }}
                placeholder={t('composer.contentPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                multiline
                textAlignVertical="top"
              />

              {/* Error */}
              {error && (
                <ThemedText style={[styles.errorText, { color: theme.danger }]}>{error}</ThemedText>
              )}

              {/* GIF preview */}
              {gif && (
                <View style={styles.mediaScroll}>
                  <View style={styles.mediaPreview}>
                    <Image source={{ uri: gif.preview }} style={styles.mediaThumb} contentFit="cover" />
                    <Pressable
                      onPress={() => setGif(null)}
                      style={[styles.removeBtn, { backgroundColor: theme.danger }]}>
                      <ThemedText style={styles.removeBtnText}>✕</ThemedText>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Media previews */}
              {media.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
                  {media.map((m, i) => (
                    <View key={m.uri} style={styles.mediaPreview}>
                      {m.type.startsWith('video/') ? (
                        <View style={[styles.mediaThumb, { backgroundColor: theme.bgSecondary }]}>
                          <Icon name="video" size={32} />
                        </View>
                      ) : (
                        <Image source={{ uri: m.uri }} style={styles.mediaThumb} contentFit="cover" />
                      )}
                      <Pressable
                        onPress={() => removeMedia(i)}
                        style={[styles.removeBtn, { backgroundColor: theme.danger }]}>
                        <ThemedText style={styles.removeBtnText}>✕</ThemedText>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </ScrollView>

            {/* Toolbar */}
            <ThemedView style={[styles.toolbar, { borderTopColor: theme.border }]}>
              <Pressable style={styles.toolBtn} onPress={handlePickImage}>
                <Icon name="camera" size={20} />
              </Pressable>
              <Pressable style={styles.toolBtn} onPress={handlePickVideo}>
                <Icon name="video" size={20} />
              </Pressable>
              <Pressable
                style={[styles.toolBtn, emojiPickerVisible && { backgroundColor: theme.bgSecondary }]}
                onPress={() => {
                  setGifPickerVisible(false);
                  setEmojiPickerVisible(true);
                }}>
                <Icon name="smile" size={20} />
              </Pressable>
              <Pressable
                style={[styles.toolBtn, gifPickerVisible && { backgroundColor: theme.bgSecondary }]}
                onPress={() => {
                  setEmojiPickerVisible(false);
                  setGifPickerVisible(true);
                }}>
                <Icon name="gif" size={20} />
              </Pressable>

              {/* Privacy selector */}
              <Pressable
                style={styles.privacyBtn}
                onPress={() => setPrivacyMenuVisible(!privacyMenuVisible)}>
                <Icon name={currentPrivacy.iconName} size={14} />
                <ThemedText themeColor="textSecondary" style={styles.privacyLabel}>
                  {t(currentPrivacy.labelKey)}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.chevron}>▾</ThemedText>
              </Pressable>

              <ThemedText
                themeColor="textSecondary"
                style={[styles.charCount, contentLength > CONTENT_MAX && { color: theme.danger }]}>
                {contentLength}/{CONTENT_MAX}
              </ThemedText>
            </ThemedView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        {/* Privacy dropdown — above keyboard */}
        {privacyMenuVisible && (
          <View style={[styles.privacyMenu, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            {PRIVACY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.privacyItem, opt.value === privacy && { backgroundColor: theme.primaryLight }]}
                onPress={() => { setPrivacy(opt.value); setPrivacyMenuVisible(false); }}>
                <Icon name={opt.iconName} size={18} />
                <ThemedText style={[styles.privacyItemLabel, { color: theme.text }]}>{t(opt.labelKey)}</ThemedText>
                {opt.value === privacy && <ThemedText style={{ color: theme.primary }}>✓</ThemedText>}
              </Pressable>
            ))}
          </View>
        )}

        {/* Emoji picker */}
        <GiphyEmojiPicker
          visible={emojiPickerVisible}
          onClose={() => setEmojiPickerVisible(false)}
          onSelect={insertEmoji}
        />

        {/* GIF picker */}
        <GiphyGifPicker
          visible={gifPickerVisible}
          onClose={() => setGifPickerVisible(false)}
          onSelect={handleGifSelect}
        />
      </ThemedView>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  headerBtnText: {
    ...Typography.body,
    fontSize: 14,
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 16,
  },
  submitBtn: {
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  submitBtnText: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 14,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: Spacing.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
  },
  authorName: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  titleInput: {
    ...Typography.h2,
    fontSize: 18,
    borderWidth: 0,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  contentInput: {
    ...Typography.body,
    fontSize: 16,
    minHeight: 160,
    borderWidth: 0,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  mediaScroll: {
    marginTop: Spacing.md,
  },
  mediaPreview: {
    width: 120,
    height: 120,
    borderRadius: Radius.md,
    marginRight: Spacing.sm,
    overflow: 'hidden',
  },
  mediaThumb: {
    width: '100%',
    height: '100%',
  },

  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  privacyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    marginLeft: 'auto',
  },

  privacyLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 10,
  },
  charCount: {
    fontSize: 11,
    marginLeft: Spacing.xs,
  },
  privacyMenu: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },

  privacyItemLabel: {
    ...Typography.body,
    fontSize: 14,
    flex: 1,
  },
});
