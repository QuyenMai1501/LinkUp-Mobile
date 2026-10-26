import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { type IconName } from '@/constants/icon-map';
import { EmojiPicker } from '@/components/emoji-picker';
import { GiphyGifPicker } from '@/components/giphy-gif-picker';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { getMyProfile } from '@/api/profile';
import { createPost } from '@/api/posts';
import { search } from '@/api/search';
import { navigateToProfile } from '@/utils/profile-nav';
import type { EmojiOption } from '@/api/emojifyi';
import type { GiphyGif } from '@/api/giphy';
import type { HashtagSearchResult } from '@/types/search';
import type { PostStatus, FeedPost } from '@/types/post';
import type { ViewProfileResponse } from '@/types/profile';

const CONTENT_MAX = 5000;
const TITLE_MAX = 150;

const DRAFT_KEY = 'linkup.composer.draft';
const DRAFT_SAVE_DEBOUNCE = 400;

// Hashtag đang gõ dở ngay trước caret (để gợi ý autocomplete) — mirror web TAG_QUERY_RE.
const TAG_QUERY_RE = /(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]*)$/u;

interface ComposerDraft {
  title: string;
  content: string;
  privacy: PostStatus;
  commentsDisabled: boolean;
  gif: GiphyGif | null;
  savedAt: number;
}

interface MediaItem {
  uri: string;
  type: string;
  name: string;
}

interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  onPosted: (post: FeedPost) => void;
  /** Đăng bài trong cộng đồng (server nhận community_id). */
  communityId?: string;
}

const PRIVACY_OPTIONS: { value: PostStatus; iconName: IconName; labelKey: string }[] = [
  { value: 'public', iconName: 'globe', labelKey: 'composer.privacy.public' },
  { value: 'friend', iconName: 'people', labelKey: 'composer.privacy.friend' },
  { value: 'private', iconName: 'lock', labelKey: 'composer.privacy.private' },
];

export default function PostComposer({ visible, onClose, onPosted, communityId }: PostComposerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [privacy, setPrivacy] = useState<PostStatus>('public');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const contentRef = useRef<TextInput>(null);
  // Idempotency key cho lần đăng hiện tại: giữ qua retry/timeout để server
  // dedupe, xoay key mới sau mỗi lần đăng thành công hoặc đóng composer.
  const clientKeyRef = useRef<string | null>(null);

  const newClientKey = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };
  const [gifPickerVisible, setGifPickerVisible] = useState(false);
  const [gif, setGif] = useState<GiphyGif | null>(null);
  const [privacyMenuVisible, setPrivacyMenuVisible] = useState(false);
  const [profile, setProfile] = useState<ViewProfileResponse | null>(null);
  const [commentsDisabled, setCommentsDisabled] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [tagQuery, setTagQuery] = useState<string | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<HashtagSearchResult[]>([]);
  // Mirror nội dung + caret bất đồng bộ với state (onSelectionChange chạy sau onChangeText)
  const contentTextRef = useRef('');
  const selectionRef = useRef({ start: 0, end: 0 });
  const draftLoadedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      getMyProfile().then(setProfile).catch(() => {});
    }
  }, [visible]);

  const writeDraft = useCallback(async () => {
    try {
      if (!(title.trim() !== '' || content.trim() !== '' || gif !== null)) {
        await AsyncStorage.removeItem(DRAFT_KEY);
        return;
      }
      const draft: ComposerDraft = {
        title,
        content,
        privacy,
        commentsDisabled,
        gif,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* AsyncStorage không khả dụng — bỏ qua draft */
    }
  }, [title, content, privacy, commentsDisabled, gif]);

  const clearDraftStorage = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
    } catch {
      /* bỏ qua */
    }
  };

  // Lưu nháp debounce khi đang mở composer (mirror web)
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      writeDraft();
    }, DRAFT_SAVE_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [visible, writeDraft]);

  // Khôi phục nháp khi mở composer (1 lần mỗi lần mở)
  useEffect(() => {
    if (!visible || draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    AsyncStorage.getItem(DRAFT_KEY)
      .then((raw) => {
        if (!raw) return;
        let parsed: ComposerDraft | null = null;
        try {
          parsed = JSON.parse(raw) as ComposerDraft | null;
        } catch {
          return;
        }
        if (!parsed || typeof parsed !== 'object') return;
        if (!parsed.title && !parsed.content && !parsed.gif) return;
        // Hydrating form state from AsyncStorage — an external system sync.
        setTitle(parsed.title || '');
        setContent(parsed.content || '');
        contentTextRef.current = parsed.content || '';
        setPrivacy(parsed.privacy ?? 'public');
        setCommentsDisabled(!!parsed.commentsDisabled);
        if (parsed.gif) setGif(parsed.gif);
        setDraftRestored(true);
      })
      .catch(() => {});
  }, [visible]);

  // Gợi ý hashtag (debounce 300ms) theo query đang gõ — mirror web
  useEffect(() => {
    if (!tagQuery) return;
    const timer = setTimeout(() => {
      search(`#${tagQuery}`, 'hashtags')
        .then((res) => setTagSuggestions(res.hashtags ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [tagQuery]);

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
    setCommentsDisabled(false);
    setDraftRestored(false);
    setTagQuery(null);
    setTagSuggestions([]);
    contentTextRef.current = '';
    selectionRef.current = { start: 0, end: 0 };
    clientKeyRef.current = null;
  }, [
    setTitle,
    setContent,
    setPrivacy,
    setMedia,
    setError,
    setEmojiPickerVisible,
    setGifPickerVisible,
    setGif,
    setPrivacyMenuVisible,
    setCommentsDisabled,
    setDraftRestored,
    setTagQuery,
    setTagSuggestions,
  ]);

  const discardDraft = () => {
    clearDraftStorage();
    reset();
  };

  const handleClose = useCallback(() => {
    writeDraft(); // lưu lần cuối — nháp giữ cho lần mở sau
    reset();
    onClose();
  }, [writeDraft, reset, onClose]);

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

  const insertEmoji = (emoji: EmojiOption) => {
    // Chèn ký tự emoji unicode — TextInput hiển thị trực tiếp, nối tiếp được nhiều emoji.
    // (Emoji picker blur input → caret luôn ở cuối; giữ contentTextRef đồng bộ với state.)
    const next = contentTextRef.current + emoji.character;
    contentTextRef.current = next;
    setContent(next);
    setError(null);
  };

  const handleGifSelect = (selected: GiphyGif) => {
    setGif(selected);
    setError(null);
  };

  // Chèn hashtag đã chọn: thay đoạn `#query` trước caret bằng `#name ` (mirror web)
  const applyTagSuggestion = (name: string) => {
    const text = contentTextRef.current;
    const caret = selectionRef.current.start;
    const before = text.slice(0, caret);
    const m = before.match(TAG_QUERY_RE);
    if (!m) return;
    const hashIdx = before.length - m[1].length - 1;
    const next = text.slice(0, hashIdx) + `#${name} ` + text.slice(caret);
    const newCaret = hashIdx + name.length + 2;
    contentTextRef.current = next;
    selectionRef.current = { start: newCaret, end: newCaret };
    setContent(next);
    setTagQuery(null);
    setTagSuggestions([]);
    setError(null);
    requestAnimationFrame(() => {
      contentRef.current?.setSelection(newCaret, newCaret);
    });
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
      if (!clientKeyRef.current) {
        clientKeyRef.current = newClientKey();
      }
      const res = await createPost({
        title: title.trim(),
        content: content.trim(),
        status: privacy,
        mediaUris: media,
        gifUrl: gif?.full,
        communityId,
        commentsEnabled: !commentsDisabled,
        clientKey: clientKeyRef.current,
      });
      await clearDraftStorage();
      reset();
      onPosted(res.data);
      if (res.warnings && res.warnings.length > 0) {
        Alert.alert(t('composer.mediaWarning'), res.warnings.join('\n'));
      }
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
                <ThemedText style={[styles.submitBtnText, { color: theme.textOnPrimary }]}>{t('composer.post')}</ThemedText>
              )}
            </Pressable>
          </ThemedView>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {/* Draft chip — đã khôi phục bản nháp lần trước */}
              {draftRestored && (
                <View style={[styles.draftChip, { backgroundColor: theme.bgSecondary }]}>
                  <Icon name="history" size={14} color={theme.textSecondary} />
                  <ThemedText themeColor="textSecondary" style={styles.draftChipText}>
                    {t('composer.draftRestored')}
                  </ThemedText>
                  <Pressable onPress={discardDraft} hitSlop={8}>
                    <ThemedText style={[styles.draftDiscard, { color: theme.danger }]}>
                      {t('composer.discardDraft')}
                    </ThemedText>
                  </Pressable>
                </View>
              )}

              {/* Author row — avatar/tên → hồ sơ mình */}
              <Pressable
                style={styles.authorRow}
                hitSlop={4}
                onPress={() => navigateToProfile(router, profile?.user_id)}>
                {profile?.avatar_uri ? (
                  <Image source={{ uri: profile.avatar_uri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.bgSecondary }]}>
                    <ThemedText style={[styles.avatarInitial, { color: theme.textSecondary }]}>
                      {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
                    </ThemedText>
                  </View>
                )}
                <ThemedText style={styles.authorName}>
                  {profile?.display_name || '...'}
                </ThemedText>
              </Pressable>

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
                ref={contentRef}
                style={[styles.contentInput, { color: theme.text }]}
                value={content}
                onChangeText={(text) => {
                  contentTextRef.current = text;
                  setContent(text);
                  setError(null);
                }}
                onSelectionChange={(e) => {
                  const { start, end } = e.nativeEvent.selection;
                  selectionRef.current = { start, end };
                  const m = contentTextRef.current.slice(0, start).match(TAG_QUERY_RE);
                  setTagQuery(m ? m[1] : null);
                  if (!m) setTagSuggestions([]);
                }}
                onFocus={() => setEmojiPickerVisible(false)}
                placeholder={t('composer.contentPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                multiline
                textAlignVertical="top"
              />

              {/* Hashtag suggestions — đang gõ #tag */}
              {tagQuery !== null && tagSuggestions.length > 0 && (
                <View style={[styles.tagSuggest, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {tagSuggestions.map((s) => (
                    <Pressable
                      key={s.name}
                      style={({ pressed }) => [
                        styles.tagSuggestItem,
                        pressed && { backgroundColor: theme.bgHover },
                      ]}
                      onPress={() => applyTagSuggestion(s.name)}>
                      <ThemedText themeColor="primary" style={styles.tagSuggestHash}>#</ThemedText>
                      <ThemedText style={styles.tagSuggestName}>{s.name}</ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.tagSuggestCount}>
                        {s.post_count}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Comments toggle */}
              <View style={[styles.optionRow, { borderTopColor: theme.border }]}>
                <Icon name="chat" size={18} />
                <ThemedText style={styles.optionLabel}>{t('composer.comments')}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.optionValue}>
                  {commentsDisabled ? t('composer.commentsOff') : t('composer.commentsOn')}
                </ThemedText>
                <Switch
                  value={!commentsDisabled}
                  onValueChange={(v) => setCommentsDisabled(!v)}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={theme.textOnPrimary}
                />
              </View>

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
                      <ThemedText style={[styles.removeBtnText, { color: theme.textOnPrimary }]}>✕</ThemedText>
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
                        <ThemedText style={[styles.removeBtnText, { color: theme.textOnPrimary }]}>✕</ThemedText>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </ScrollView>

            {/* Emoji panel inline — trên toolbar, không che nội dung/ô nhập */}
            {emojiPickerVisible && (
              <EmojiPicker
                onClose={() => setEmojiPickerVisible(false)}
                onSelect={insertEmoji}
              />
            )}

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
                  contentRef.current?.blur();
                  Keyboard.dismiss();
                  setEmojiPickerVisible((prev) => !prev);
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
  draftChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  draftChipText: {
    flex: 1,
    fontSize: 12,
  },
  draftDiscard: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagSuggest: {
    borderWidth: 1,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  tagSuggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  tagSuggestHash: {
    fontSize: 14,
    fontWeight: '700',
  },
  tagSuggestName: {
    ...Typography.body,
    fontSize: 14,
    flex: 1,
  },
  tagSuggestCount: {
    fontSize: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  optionLabel: {
    ...Typography.body,
    fontSize: 14,
    flex: 1,
  },
  optionValue: {
    fontSize: 12,
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
