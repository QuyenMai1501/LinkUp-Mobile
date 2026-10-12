import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { uploadMedia } from '@/api/profile';
import {
  deleteGroupChatBackground,
  updateGroupChatBackground,
  type GroupChatBackground,
} from '@/api/group-chat';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

// Mirror Web ChatBackgroundPicker — bỏ tab preset (static files chỉ có ở Web).
const SOLID_COLORS = [
  '#FFE4C4', '#E8D5B7', '#B5D8CC', '#AEC6CF', '#C7CEEA', '#F6C6CE',
  '#F0E68C', '#DDA0DD', '#98FB98', '#FFB6C1', '#B0E0E6', '#D2B48C',
  '#E6E6FA', '#FFF0F5', '#F5FFFA', '#F0FFF0', '#F5F5DC', '#FAEBD7',
  '#FFE4E1', '#FFF8DC', '#F5F5F5', '#FAFAFA',
];

// Gradient lưu đúng CSS string của Web — render parse 2 màu đầu.
const GRADIENTS = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fad0c4, #ffd1ff)',
  'linear-gradient(135deg, #ffecd2, #fcb69f)',
  'linear-gradient(135deg, #89f7fe, #66a6ff)',
  'linear-gradient(135deg, #fddb92, #d1fdff)',
  'linear-gradient(135deg, #c1dfc4, #deecdd)',
  'linear-gradient(135deg, #0ba360, #3cba92)',
];

/** Parse "linear-gradient(135deg, #aaa, #bbb)" → ['#aaa', '#bbb']. */
export function parseGradientColors(css: string): [string, string] {
  const colors = css.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g) ?? [];
  return [colors[0] ?? '#667eea', colors[1] ?? colors[0] ?? '#764ba2'];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  currentBackground: GroupChatBackground | null;
  onApplied: (bg: GroupChatBackground | null) => void;
}

type TabKey = 'solid' | 'gradient' | 'custom';

/**
 * Chọn nền trò chuyện cho nhóm — mirror Web ChatBackgroundPicker
 * (solid/gradient/custom; bỏ preset vì static files chỉ phục vụ Web).
 */
export function ChatBackgroundPicker({
  visible,
  onClose,
  chatId,
  currentBackground,
  onApplied,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('solid');
  const [selected, setSelected] = useState<GroupChatBackground | null>(
    currentBackground,
  );
  const [saving, setSaving] = useState(false);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setSelected(currentBackground);
      setActiveTab('solid');
    }
    prevVisibleRef.current = visible;
  }, [visible, currentBackground]);

  const handleRemove = useCallback(() => {
    if (saving) return;
    setSaving(true);
    deleteGroupChatBackground(chatId)
      .then(() => {
        setSelected(null);
        onApplied(null);
        Alert.alert(t('chat.backgroundApplied'));
        onClose();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert(t('common.error'), msg || t('common.error'));
      })
      .finally(() => setSaving(false));
  }, [saving, chatId, onApplied, onClose, t]);

  const handleApply = useCallback(() => {
    if (!selected || saving) return;
    setSaving(true);
    updateGroupChatBackground(chatId, selected.type, selected.value)
      .then(() => {
        onApplied(selected);
        Alert.alert(t('chat.backgroundApplied'));
        onClose();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert(t('common.error'), msg || t('common.error'));
      })
      .finally(() => setSaving(false));
  }, [selected, saving, chatId, onApplied, onClose, t]);

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
        Alert.alert(t('common.error'), msg || t('common.error'));
      } finally {
        setSaving(false);
      }
    })();
  }, [saving, t]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'solid', label: t('chat.backgroundSolid') },
    { key: 'gradient', label: t('chat.backgroundGradient') },
    { key: 'custom', label: t('chat.backgroundCustom') },
  ];

  const isSelected = (bg: GroupChatBackground) =>
    selected?.type === bg.type && selected?.value === bg.value;

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
                    onPress={() => setSelected({ type: 'solid', value: color })}
                    style={[
                      styles.swatch,
                      { backgroundColor: color },
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
                    onPress={() => setSelected({ type: 'gradient', value: css })}
                    style={[
                      styles.swatch,
                      { overflow: 'hidden' },
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

          {activeTab === 'custom' && (
            <View style={styles.customSection}>
              <Pressable
                onPress={handleUpload}
                disabled={saving}
                style={[styles.uploadBtn, { backgroundColor: theme.primary }]}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Icon name="images" size={16} color="#FFF" />
                    <ThemedText style={{ color: '#FFF', fontWeight: '600' }}>
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
                {selected.type === 'solid' ? (
                  <View style={[styles.previewFill, { backgroundColor: selected.value }]} />
                ) : selected.type === 'gradient' ? (
                  <LinearGradient
                    colors={parseGradientColors(selected.value)}
                    style={styles.previewFill}
                  />
                ) : null}
              </View>
            </View>
          )}
        </ScrollView>

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
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <ThemedText style={{ color: '#FFF', fontWeight: '600' }}>
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
    width: '22%',
    aspectRatio: 1,
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
