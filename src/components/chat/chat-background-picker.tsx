import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showAlert } from '@/utils/alert';
import { uploadMedia } from '@/api/profile';
import { deleteChatBackground, updateChatBackground } from '@/api/chat';
import {
  deleteGroupChatBackground,
  updateGroupChatBackground,
} from '@/api/group-chat';
import { PRESET_FILENAMES, PRESET_IMAGES } from '@/constants/chat-bg-presets';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { ChatBackground } from '@/types/chat';
import {
  backgroundClashes,
  recommendedStrength,
} from '@/utils/chat-readability';

// Bộ màu/gradient khớp Web ChatBackgroundPicker (parity 1-1).
const SOLID_COLORS = [
  '#12A5A1', '#0E8B88', '#0A6E6B', '#0A1F44', '#14315E', '#1E4A7A',
  '#B5D8CC', '#AEC6CF', '#C7CEEA', '#E6F4F3', '#F5F5F5', '#1A1A1A',
];

// Gradient lưu đúng CSS string của Web — render parse 2 màu đầu.
const GRADIENTS = [
  'linear-gradient(135deg, #12A5A1, #0A1F44)',
  'linear-gradient(135deg, #0A1F44, #764ba2)',
  'linear-gradient(135deg, #0A1F44, #3B4A6B)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #89f7fe, #66a6ff)',
  'linear-gradient(135deg, #a1c4fd, #c2e9fb)',
  'linear-gradient(135deg, #0ba360, #3cba92)',
  'linear-gradient(135deg, #c1dfc4, #deecdd)',
];

const STRENGTH_MIN = 30;
const STRENGTH_MAX = 150;
const STRENGTH_STEP = 5;
const SLIDER_THUMB = 22;
const SLIDER_H = 32;

/** Parse "linear-gradient(135deg, #aaa, #bbb)" → ['#aaa', '#bbb']. */
export function parseGradientColors(css: string): [string, string] {
  const colors = css.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g) ?? [];
  return [colors[0] ?? '#667eea', colors[1] ?? colors[0] ?? '#764ba2'];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** direct = chat 1-1 (api /chats), group = chat nhóm (api /group-chats). */
  mode: 'direct' | 'group';
  chatId: string;
  currentBackground: ChatBackground | null;
  onApplied: (bg: ChatBackground | null) => void;
}

type TabKey = 'solid' | 'gradient' | 'preset' | 'custom';

/**
 * Chọn nền trò chuyện — mirror Web ChatBackgroundPicker đầy đủ
 * (solid/gradient/preset/custom + slider độ phủ + cảnh báo màu xung đột).
 */
export function ChatBackgroundPicker({
  visible,
  onClose,
  mode,
  chatId,
  currentBackground,
  onApplied,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width: winW } = useWindowDimensions();
  // Ô màu vuông px cố định — width % + aspectRatio bị Yoga bỏ qua trong
  // flexWrap trên RN 0.86 (thành dải ngang). 4 cột: padding md 2 bên + 3 gap.
  const CELL = Math.floor((winW - Spacing.md * 2 - Spacing.sm * 3) / 4);
  // Preset 3 cột như Web.
  const PRESET_CELL = Math.floor((winW - Spacing.md * 2 - Spacing.sm * 2) / 3);
  const [activeTab, setActiveTab] = useState<TabKey>('solid');
  const [selected, setSelected] = useState<ChatBackground | null>(
    currentBackground,
  );
  const [strength, setStrength] = useState(
    () => currentBackground?.overlay_strength ?? 100,
  );
  // Badge "Tự động" — bật khi slider còn đúng giá trị đề xuất; tắt khi kéo.
  const [strengthAuto, setStrengthAuto] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trackW, setTrackW] = useState(0);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setSelected(currentBackground);
      setActiveTab('solid');
      setStrength(currentBackground?.overlay_strength ?? 100);
      setStrengthAuto(true);
    }
    prevVisibleRef.current = visible;
  }, [visible, currentBackground]);

  const handleSelect = useCallback((bg: ChatBackground) => {
    setSelected(bg);
    // Đề xuất độ phủ cho lựa chọn mới (color-clash → 130); người dùng vẫn
    // kéo slider sau đó (kéo = bỏ badge tự động).
    setStrength(recommendedStrength(bg));
    setStrengthAuto(true);
  }, []);

  const handleRemove = useCallback(() => {
    if (saving) return;
    setSaving(true);
    const req =
      mode === 'group'
        ? deleteGroupChatBackground(chatId)
        : deleteChatBackground(chatId);
    req
      .then(() => {
        setSelected(null);
        onApplied(null);
        showAlert(t('chat.backgroundApplied'));
        onClose();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        showAlert(t('common.error'), msg || t('common.error'));
      })
      .finally(() => setSaving(false));
  }, [saving, mode, chatId, onApplied, onClose, t]);

  const handleApply = useCallback(() => {
    if (!selected || saving) return;
    setSaving(true);
    const clamped = Math.min(
      STRENGTH_MAX,
      Math.max(STRENGTH_MIN, Math.round(strength)),
    );
    const req =
      mode === 'group'
        ? updateGroupChatBackground(chatId, selected.type, selected.value, clamped)
        : updateChatBackground(chatId, selected.type, selected.value, clamped);
    req
      .then(() => {
        onApplied({ ...selected, overlay_strength: clamped });
        showAlert(t('chat.backgroundApplied'));
        onClose();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        showAlert(t('common.error'), msg || t('common.error'));
      })
      .finally(() => setSaving(false));
  }, [selected, strength, saving, mode, chatId, onApplied, onClose, t]);

  const handleUpload = useCallback(() => {
    if (saving) return;
    void (async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setSaving(true);
      try {
        const res = await uploadMedia(
          asset.uri,
          asset.fileName ?? 'background.jpg',
          asset.mimeType ?? 'image/jpeg',
        );
        const url = res?.data?.file_uri;
        if (url) setSelected({ type: 'custom', value: url });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showAlert(t('common.error'), msg || t('common.error'));
      } finally {
        setSaving(false);
      }
    })();
  }, [saving, t]);

  // Slider 30–150 step 5 bằng PanResponder (view thuần — không thêm dep).
  const setStrengthFromX = useCallback(
    (x: number) => {
      if (trackW <= 0) return;
      const ratio = Math.min(1, Math.max(0, x / trackW));
      const raw = STRENGTH_MIN + ratio * (STRENGTH_MAX - STRENGTH_MIN);
      const stepped = Math.round(raw / STRENGTH_STEP) * STRENGTH_STEP;
      setStrength(Math.min(STRENGTH_MAX, Math.max(STRENGTH_MIN, stepped)));
      setStrengthAuto(false);
    },
    [trackW],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => setStrengthFromX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => setStrengthFromX(e.nativeEvent.locationX),
      }),
    [setStrengthFromX],
  );

  const strengthRatio =
    (Math.min(STRENGTH_MAX, Math.max(STRENGTH_MIN, strength)) - STRENGTH_MIN) /
    (STRENGTH_MAX - STRENGTH_MIN);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'solid', label: t('chat.backgroundSolid') },
    { key: 'gradient', label: t('chat.backgroundGradient') },
    { key: 'preset', label: t('chat.backgroundPreset') },
    { key: 'custom', label: t('chat.backgroundCustom') },
  ];

  const isSelected = (bg: ChatBackground) =>
    selected?.type === bg.type && selected?.value === bg.value;

  const renderPreviewFill = () => {
    if (!selected) return null;
    if (selected.type === 'solid') {
      return (
        <View style={[styles.previewFill, { backgroundColor: selected.value }]} />
      );
    }
    if (selected.type === 'gradient') {
      return (
        <LinearGradient
          colors={parseGradientColors(selected.value)}
          style={styles.previewFill}
        />
      );
    }
    if (selected.type === 'preset') {
      const src = PRESET_IMAGES[selected.value];
      if (!src) return null;
      return <Image source={src} style={styles.previewFill} contentFit="cover" />;
    }
    if (selected.type === 'custom' && selected.value) {
      return (
        <Image
          source={{ uri: selected.value }}
          style={styles.previewFill}
          contentFit="cover"
        />
      );
    }
    return null;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.headerBtn}>
            <ThemedText style={{ color: theme.primary }}>
              {t('common.cancel')}
            </ThemedText>
          </Pressable>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            {t('chat.backgroundPicker')}
          </ThemedText>
          <View style={styles.headerBtn} />
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tab,
                  active && { borderBottomColor: theme.primary },
                ]}>
                <ThemedText
                  style={{
                    color: active ? theme.primary : theme.textSecondary,
                    fontWeight: active ? '700' : '500',
                    fontSize: 13,
                  }}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === 'solid' && (
            <View style={styles.grid}>
              {SOLID_COLORS.map((color) => {
                const active = isSelected({ type: 'solid', value: color });
                return (
                  <Pressable
                    key={color}
                    onPress={() => handleSelect({ type: 'solid', value: color })}
                    style={[
                      styles.swatch,
                      { width: CELL, height: CELL, backgroundColor: color },
                      active && { borderColor: theme.primary, borderWidth: 3 },
                    ]}
                  />
                );
              })}
            </View>
          )}

          {activeTab === 'gradient' && (
            <View style={styles.grid}>
              {GRADIENTS.map((css) => {
                const active = isSelected({ type: 'gradient', value: css });
                return (
                  <Pressable
                    key={css}
                    onPress={() => handleSelect({ type: 'gradient', value: css })}
                    style={[
                      styles.swatch,
                      { width: CELL, height: CELL, overflow: 'hidden' },
                      active && { borderColor: theme.primary, borderWidth: 3 },
                    ]}>
                    <LinearGradient
                      colors={parseGradientColors(css)}
                      style={styles.swatchFill}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}

          {activeTab === 'preset' && (
            <View style={styles.grid}>
              {PRESET_FILENAMES.map((file) => {
                const active = isSelected({ type: 'preset', value: file });
                return (
                  <Pressable
                    key={file}
                    onPress={() => handleSelect({ type: 'preset', value: file })}
                    style={[
                      styles.swatch,
                      { width: PRESET_CELL, height: PRESET_CELL, overflow: 'hidden' },
                      active && { borderColor: theme.primary, borderWidth: 3 },
                    ]}>
                    <Image
                      source={PRESET_IMAGES[file]}
                      style={styles.swatchFill}
                      contentFit="cover"
                    />
                  </Pressable>
                );
              })}
            </View>
          )}

          {activeTab === 'custom' && (
            <View style={styles.customSection}>
              <Pressable
                onPress={handleUpload}
                disabled={saving}
                style={[styles.uploadBtn, { backgroundColor: theme.primary }]}>
                {saving ? (
                  <ActivityIndicator size="small" color={theme.textOnPrimary} />
                ) : (
                  <>
                    <Icon name="images" size={16} color={theme.textOnPrimary} />
                    <ThemedText style={{ color: theme.textOnPrimary, fontWeight: '600' }}>
                      {t('chat.backgroundUpload')}
                    </ThemedText>
                  </>
                )}
              </Pressable>
              {selected?.type === 'custom' && selected.value ? (
                <Image
                  source={{ uri: selected.value }}
                  style={styles.customPreview}
                  contentFit="cover"
                />
              ) : (
                <ThemedText themeColor="textSecondary">
                  {t('chat.backgroundDefault')}
                </ThemedText>
              )}
            </View>
          )}

          {/* Preview của selection hiện tại */}
          {selected && activeTab !== 'custom' && (
            <View style={styles.previewWrap}>
              <ThemedText themeColor="textSecondary" style={styles.previewLabel}>
                {t('chat.backgroundPicker')}
              </ThemedText>
              <View style={[styles.preview, { borderColor: theme.border }]}>
                {renderPreviewFill()}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Slider độ phủ — luôn hiện (parity Web) */}
        <View style={[styles.strengthSection, { borderTopColor: theme.border }]}>
          <View style={styles.strengthRow}>
            <ThemedText
              style={[styles.strengthLabel, { color: theme.textSecondary }]}>
              {t('chat.bgOverlayStrength')}
            </ThemedText>
            <View
              style={styles.sliderWrap}
              onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
              pointerEvents={saving ? 'none' : 'auto'}
              {...panResponder.panHandlers}>
              <View
                style={[styles.sliderTrack, { backgroundColor: theme.bgSecondary }]}
              />
              <View
                style={[
                  styles.sliderFill,
                  {
                    backgroundColor: theme.primary,
                    width: strengthRatio * trackW,
                  },
                ]}
              />
              <View
                style={[
                  styles.sliderThumb,
                  {
                    backgroundColor: theme.primary,
                    left: strengthRatio * Math.max(0, trackW - SLIDER_THUMB),
                  },
                ]}
              />
            </View>
            <ThemedText style={[styles.strengthValue, { color: theme.text }]}>
              {strength}%
              {strengthAuto ? ` · ${t('chat.bgAuto')}` : ''}
            </ThemedText>
          </View>

          {selected && backgroundClashes(selected) && (
            <View
              style={[styles.clashWarn, { backgroundColor: theme.warningLight }]}>
              <Icon
                name="warning"
                size={16}
                color={theme.warning}
                style={styles.clashWarnIcon}
              />
              <ThemedText
                style={[styles.clashWarnText, { color: theme.text }]}>
                {t('chat.bgClashWarning')}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Pressable
            onPress={handleRemove}
            disabled={saving || !currentBackground}
            style={[
              styles.footerBtn,
              { backgroundColor: theme.bgSecondary },
              !currentBackground && styles.disabled,
            ]}>
            <ThemedText style={{ color: theme.danger }}>
              {t('chat.backgroundRemove')}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleApply}
            disabled={saving || !selected}
            style={[
              styles.footerBtn,
              { backgroundColor: theme.primary },
              (!selected || saving) && styles.disabled,
            ]}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.textOnPrimary} />
            ) : (
              <ThemedText style={{ color: theme.textOnPrimary, fontWeight: '600' }}>
                {t('chat.backgroundApply')}
              </ThemedText>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minWidth: 60,
    alignItems: 'center',
  },
  title: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  swatch: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  swatchFill: {
    flex: 1,
  },
  customSection: {
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  customPreview: {
    width: '100%',
    height: 160,
    borderRadius: 8,
  },
  previewWrap: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  previewLabel: {
    ...Typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  preview: {
    height: 120,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  previewFill: {
    flex: 1,
  },
  strengthSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.sm,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  strengthLabel: {
    ...Typography.caption,
    fontWeight: '600',
    flexShrink: 0,
  },
  sliderWrap: {
    flex: 1,
    height: SLIDER_H,
    justifyContent: 'center',
  },
  sliderTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: SLIDER_THUMB,
    height: SLIDER_THUMB,
    borderRadius: SLIDER_THUMB / 2,
    top: (SLIDER_H - SLIDER_THUMB) / 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  strengthValue: {
    ...Typography.caption,
    fontWeight: '700',
    minWidth: 74,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  clashWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: 8,
  },
  clashWarnIcon: {
    marginTop: 2,
  },
  clashWarnText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});
