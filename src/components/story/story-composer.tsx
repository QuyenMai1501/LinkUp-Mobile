import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

import { showAlert } from '@/utils/alert';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import StoryEditor, { type StoryEditorHandle } from '@/components/story/story-editor';
import {
  IDENTITY_TRANSFORM,
  type StoryEditorDoc,
} from '@/components/story/story-editor-constants';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import { createStories } from '@/api/story';
import { TEXT_GRADIENTS } from '@/utils/story-gradient';

const MAX_PHOTOS = 10;

type Step = 'pick' | 'edit' | 'post';

interface PickedAsset {
  uri: string;
  fileName: string;
  mimeType: string;
}

interface StoryComposerProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function StoryComposer({ visible, onClose, onCreated }: StoryComposerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { height: winH, width: winW } = useWindowDimensions();
  // Giữ preview trong tầm nhìn: không cao hơn ~45% chiều cao màn hình
  const previewMaxH = Math.round(winH * 0.45);
  const contentW = winW - Spacing.md * 2;
  const frameW = Math.min(contentW, Math.floor((previewMaxH * 9) / 16));
  const frameH = Math.round((frameW * 16) / 9);

  const [mode, setMode] = useState<'photos' | 'text'>('photos');
  const [step, setStep] = useState<Step>('pick');
  const [assets, setAssets] = useState<PickedAsset[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);
  const [docs, setDocs] = useState<StoryEditorDoc[]>([]);
  const [finalUris, setFinalUris] = useState<(string | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [textContent, setTextContent] = useState('');
  const [textGradientIndex, setTextGradientIndex] = useState(0);
  const [posting, setPosting] = useState(false);
  const editorRef = useRef<StoryEditorHandle>(null);

  const reset = useCallback(() => {
    setMode('photos');
    setStep('pick');
    setAssets([]);
    setCaptions([]);
    setDocs([]);
    setFinalUris([]);
    setActiveIndex(0);
    setTextContent('');
    setTextGradientIndex(0);
    setPosting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (posting) return;
    // Đã có nội dung mà đóng → xác nhận "Bỏ draft?" (đồng bộ Web)
    const hasDraft = mode === 'photos' ? assets.length > 0 : textContent.trim().length > 0;
    if (hasDraft) {
      showAlert(t('story.discardTitle'), t('story.discardConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('story.discardBtn'),
          style: 'destructive',
          onPress: () => {
            reset();
            onClose();
          },
        },
      ]);
      return;
    }
    reset();
    onClose();
  }, [assets.length, mode, onClose, posting, reset, t, textContent]);

  const pickPhotos = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('common.error'), t('story.permissionNeeded'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;

    const picked: PickedAsset[] = result.assets.map((a, i) => ({
      uri: a.uri,
      fileName: a.fileName || `story-${Date.now()}-${i}.jpg`,
      mimeType: a.mimeType || 'image/jpeg',
    }));

    if (picked.length > MAX_PHOTOS) {
      showAlert(t('common.error'), t('story.multiErrorMax'));
      return;
    }

    const next = [...assets, ...picked].slice(0, MAX_PHOTOS);
    setAssets(next);
    setCaptions((prevCaps) => {
      const arr = [...prevCaps];
      while (arr.length < next.length) arr.push('');
      return arr.slice(0, next.length);
    });
    setDocs((prevDocs) => {
      const arr = [...prevDocs];
      while (arr.length < next.length) {
        arr.push({ bg: { ...IDENTITY_TRANSFORM }, layers: [] });
      }
      return arr.slice(0, next.length);
    });
    setFinalUris((prevUris) => {
      const arr = [...prevUris];
      while (arr.length < next.length) arr.push(null);
      return arr.slice(0, next.length);
    });
  }, [assets, t]);

  const removeAsset = useCallback(
    (index: number) => {
      setAssets((prev) => prev.filter((_, i) => i !== index));
      setCaptions((prev) => prev.filter((_, i) => i !== index));
      setDocs((prev) => prev.filter((_, i) => i !== index));
      setFinalUris((prev) => prev.filter((_, i) => i !== index));
      setActiveIndex((prev) => Math.max(0, Math.min(prev, assets.length - 2)));
    },
    [assets.length],
  );

  const setCaption = useCallback((index: number, value: string) => {
    setCaptions((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  }, []);

  const setDoc = useCallback((index: number, doc: StoryEditorDoc) => {
    setDocs((prev) => {
      const arr = [...prev];
      arr[index] = doc;
      return arr;
    });
  }, []);

  const flushCurrent = useCallback(async (): Promise<string | null> => {
    const exported = (await editorRef.current?.flush()) ?? null;
    if (exported) {
      setFinalUris((prev) => {
        const arr = [...prev];
        arr[activeIndex] = exported;
        return arr;
      });
    }
    return exported;
  }, [activeIndex]);

  const onThumbPress = useCallback(
    (i: number) => {
      if (i === activeIndex) return;
      if (step === 'edit') {
        flushCurrent().then(() => setActiveIndex(i));
        return;
      }
      setActiveIndex(i);
    },
    [activeIndex, flushCurrent, step],
  );

  const switchMode = useCallback((nextMode: 'photos' | 'text') => {
    setMode(nextMode);
    setStep('pick');
  }, []);

  const handlePost = useCallback(async () => {
    if (posting) return;
    setPosting(true);
    try {
      if (mode === 'photos') {
        if (assets.length === 0) {
          showAlert(t('common.error'), t('story.contentRequired'));
          setPosting(false);
          return;
        }
        await createStories(
          assets.map((a, i) => {
            const exported = finalUris[i];
            return {
              fileUri: exported ?? a.uri,
              fileName: exported ? `story-${i + 1}.jpg` : a.fileName,
              mimeType: exported ? 'image/jpeg' : a.mimeType,
              caption: (captions[i] ?? '').trim(),
            };
          }),
        );
      } else {
        const text = textContent.trim();
        if (!text) {
          showAlert(t('common.error'), t('story.contentRequired'));
          setPosting(false);
          return;
        }
        await createStories([{ caption: text }]);
      }
      showAlert(t('common.success'), t('story.created'));
      reset();
      onCreated?.();
      onClose();
    } catch (err) {
      showAlert(t('common.error'), err instanceof Error ? err.message : t('common.error'));
    } finally {
      setPosting(false);
    }
  }, [assets, captions, finalUris, mode, onClose, onCreated, posting, reset, t, textContent]);

  const currentAsset = assets[activeIndex];
  const isText = mode === 'text';
  const showTabs = isText || step === 'pick';
  const canAdvance = assets.length > 0;

  const renderHeaderLeft = () => {
    if (!isText && step !== 'pick') {
      return (
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('story.editor.back')}
          onPress={() => setStep(step === 'post' ? 'edit' : 'pick')}>
          <Icon name="chevronLeft" size={26} />
        </Pressable>
      );
    }
    return (
      <Pressable hitSlop={8} accessibilityRole="button" onPress={handleClose}>
        <Icon name="close" size={26} />
      </Pressable>
    );
  };

  const renderHeaderRight = () => {
    if (isText || step === 'post') {
      return (
        <Pressable
          disabled={posting}
          onPress={handlePost}
          style={[styles.postBtn, { backgroundColor: theme.primary }, posting && styles.postBtnDisabled]}>
          <ThemedText style={[styles.postBtnText, { color: theme.textOnPrimary }]}>
            {posting ? t('story.posting') : t('story.submit')}
          </ThemedText>
        </Pressable>
      );
    }
    return (
      <Pressable
        disabled={!canAdvance}
        onPress={() => {
          if (step === 'pick') {
            setStep('edit');
            return;
          }
          flushCurrent().then(() => setStep('post'));
        }}
        style={[
          styles.postBtn,
          { backgroundColor: theme.primary },
          !canAdvance && styles.postBtnDisabled,
        ]}>
        <ThemedText style={[styles.postBtnText, { color: theme.textOnPrimary }]}>
          {t('story.next')}
        </ThemedText>
      </Pressable>
    );
  };

  const renderThumbs = (withAdd: boolean) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
      {assets.map((a, i) => (
        <Pressable key={`${a.uri}-${i}`} onPress={() => onThumbPress(i)}>
          <Image
            source={{ uri: finalUris[i] ?? a.uri }}
            style={[styles.thumb, i === activeIndex && { borderColor: theme.primary, borderWidth: 2 }]}
            contentFit="cover"
          />
        </Pressable>
      ))}
      {withAdd && assets.length < MAX_PHOTOS && (
        <Pressable style={styles.addThumb} onPress={pickPhotos} accessibilityLabel={t('story.editor.addMore')}>
          <Icon name="add" size={22} />
        </Pressable>
      )}
    </ScrollView>
  );

  const renderPhotosBody = () => {
    if (step === 'pick') {
      if (assets.length === 0) {
        return (
          <ScrollView contentContainerStyle={[styles.body, styles.bodyGrow]} showsVerticalScrollIndicator={false}>
            <Pressable style={styles.pickArea} onPress={pickPhotos}>
              <Icon name="images" size={48} />
              <ThemedText style={styles.pickTitle}>{t('story.mediaPlaceholder')}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.pickHint}>
                {t('story.selectPhotosHint')}
              </ThemedText>
            </Pressable>
          </ScrollView>
        );
      }
      return (
        <ScrollView contentContainerStyle={[styles.body, styles.bodyGrow]} showsVerticalScrollIndicator={false}>
          <View style={[styles.previewWrap, { maxHeight: previewMaxH }]}>
            {currentAsset && (
              <Image source={{ uri: currentAsset.uri }} style={styles.previewImg} contentFit="cover" />
            )}
            <Pressable style={styles.removeBtn} hitSlop={8} onPress={() => removeAsset(activeIndex)}>
              <Icon name="close" size={18} color={theme.textOnPrimary} />
            </Pressable>
            <View style={styles.counter}>
              <ThemedText style={[styles.counterText, { color: theme.textOnPrimary }]}>
                {activeIndex + 1}/{assets.length}
              </ThemedText>
            </View>
          </View>
          {renderThumbs(true)}
        </ScrollView>
      );
    }

    if (step === 'edit') {
      return (
        <View style={styles.editBody}>
          {currentAsset && (
            <StoryEditor
              ref={editorRef}
              key={`${activeIndex}:${currentAsset.uri}`}
              uri={currentAsset.uri}
              doc={docs[activeIndex] ?? { bg: { ...IDENTITY_TRANSFORM }, layers: [] }}
              onChange={(d) => setDoc(activeIndex, d)}
              index={activeIndex}
              total={assets.length}
              width={frameW}
              height={frameH}
            />
          )}
          {renderThumbs(true)}
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={[styles.body, styles.bodyGrow]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.postPreview, { width: frameW, height: frameH }]}>
          {currentAsset && (
            <Image
              source={{ uri: finalUris[activeIndex] ?? currentAsset.uri }}
              style={styles.previewImg}
              contentFit="cover"
            />
          )}
          <Pressable style={styles.removeBtn} hitSlop={8} onPress={() => removeAsset(activeIndex)}>
            <Icon name="close" size={18} color={theme.textOnPrimary} />
          </Pressable>
          <View style={styles.counter}>
            <ThemedText style={[styles.counterText, { color: theme.textOnPrimary }]}>
              {activeIndex + 1}/{assets.length}
            </ThemedText>
          </View>
        </View>
        {renderThumbs(false)}
        <TextInput
          style={[styles.captionInput, { borderColor: theme.border, color: theme.text }]}
          placeholder={t('story.captionPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          value={captions[activeIndex] ?? ''}
          onChangeText={(v) => setCaption(activeIndex, v)}
          maxLength={300}
          multiline
        />
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            {renderHeaderLeft()}
            <ThemedText style={styles.headerTitle}>
              {!isText && step === 'edit' ? t('story.editor.title') : t('story.createTitle')}
            </ThemedText>
            {renderHeaderRight()}
          </View>

          {/* Mode tabs — mọi tab luôn có border 2px (trong suốt), active chỉ đổi màu
              để 2 nhãn không bị lệch cao khi chuyển tab */}
          {showTabs && (
            <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
              <Pressable
                style={[styles.tab, mode === 'photos' && { borderBottomColor: theme.primary }]}
                onPress={() => switchMode('photos')}>
                <ThemedText
                  style={[styles.tabText, mode === 'photos' && { color: theme.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}>
                  {t('story.photoMode')}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.tab, mode === 'text' && { borderBottomColor: theme.primary }]}
                onPress={() => switchMode('text')}>
                {/* numberOfLines + adjustsFontSizeToFit: fontScale lớn (cỡ chữ hệ thống to) vẫn 1 dòng */}
                <ThemedText
                  style={[styles.tabText, mode === 'text' && { color: theme.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}>
                  {t('story.textStory')}
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* Body — KAV chỉ bọc phần dưới header/tabs để bàn phím không đẩy header */}
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {isText ? (
              <ScrollView
                contentContainerStyle={[styles.body, styles.bodyGrow]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <LinearGradient
                  colors={TEXT_GRADIENTS[textGradientIndex % TEXT_GRADIENTS.length]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.textPreview}>
                  <TextInput
                    style={[styles.textStoryInput, { color: theme.textOnPrimary }]}
                    placeholder={t('story.textStoryHint')}
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    value={textContent}
                    onChangeText={setTextContent}
                    multiline
                    maxLength={300}
                  />
                </LinearGradient>
                <View style={styles.gradientRow}>
                  {TEXT_GRADIENTS.map((g, i) => (
                    <Pressable key={g[0]} onPress={() => setTextGradientIndex(i)}>
                      <LinearGradient
                        colors={g}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.gradientDot, i === textGradientIndex && [styles.gradientDotActive, { borderColor: theme.textOnPrimary }]]}
                      />
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.charCount}>{textContent.length}/300</Text>
              </ScrollView>
            ) : (
              renderPhotosBody()
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { ...Typography.h2, fontSize: 16, fontWeight: '700' },
  postBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnDisabled: {
    opacity: 0.5,
  },
  postBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    // Border cố định cho mọi tab — tab active chỉ đổi màu (hết lệch cao ~1-2px)
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    ...Typography.body,
    fontWeight: '600',
  },
  body: {
    padding: Spacing.md,
  },
  bodyGrow: {
    flexGrow: 1,
  },
  editBody: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  pickArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    borderColor: 'rgba(128,128,128,0.4)',
    minHeight: 320,
  },
  pickTitle: { ...Typography.body, fontWeight: '600' },
  pickHint: { ...Typography.caption },
  previewWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  postPreview: {
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  previewImg: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  addThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(128,128,128,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 72,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  textPreview: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  textStoryInput: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 120,
    textAlignVertical: 'center',
  },
  gradientRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: Spacing.md,
  },
  gradientDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  gradientDotActive: {
    borderWidth: 2,
  },
  charCount: {
    ...Typography.caption,
    textAlign: 'center',
    marginTop: 6,
  },
});
