import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

const DESCRIPTION_MAX = 500;

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * Đăng lại bài viết.
   * content = mô tả tùy chọn đã trim (rỗng → undefined).
   */
  onRepost: (content?: string) => void;
  /** Mở form gửi bài viết cho bạn bè. */
  onSendToFriend: () => void;
}

/**
 * Bottom sheet chọn hành động khi bấm Chia sẻ:
 * - Bước 1: Đăng lại / Gửi cho bạn bè / Hủy
 * - Bước 2 (sau khi bấm Đăng lại): ô mô tả tùy chọn + nút Hủy / Đăng lại
 */
export function ShareOptionsSheet({ visible, onClose, onRepost, onSendToFriend }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [step, setStep] = useState<'menu' | 'repost'>('menu');
  const [description, setDescription] = useState('');

  // Đóng sheet = reset về bước menu, xóa mô tả (mọi đường đóng đều đi qua đây).
  const close = () => {
    setStep('menu');
    setDescription('');
    onClose();
  };

  const submitRepost = () => {
    const content = description.trim();
    close();
    onRepost(content || undefined);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => (step === 'menu' ? close() : setStep('menu'))}>
      {/* Backdrop — bước 1 bấm nền để đóng; bước 2 chỉ đóng bằng nút/back. */}
      <Pressable
        style={styles.backdrop}
        onPress={step === 'menu' ? close : undefined}
      />

      {/* KAV bọc toàn sheet (iOS padding / Android height) — đẩy input + nút lên trên bàn phím */}
      <KeyboardAvoidingView
        style={styles.sheetContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.card }]}
          onPress={(e) => e.stopPropagation()}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {step === 'menu' ? (
            <>
              <ThemedText themeColor="textSecondary" style={styles.title}>
                {t('post.share')}
              </ThemedText>

              <Pressable
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.bgHover }]}
                onPress={() => setStep('repost')}>
                <Icon name="refresh" size={22} color={theme.text} />
                <ThemedText style={[styles.rowText, { color: theme.text }]}>
                  {t('post.repost')}
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.bgHover }]}
                onPress={() => {
                  close();
                  onSendToFriend();
                }}>
                <Icon name="send" size={22} color={theme.text} />
                <ThemedText style={[styles.rowText, { color: theme.text }]}>
                  {t('post.shareToFriend')}
                </ThemedText>
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  styles.cancelRow,
                  pressed && { backgroundColor: theme.bgHover },
                ]}
                onPress={close}>
                <ThemedText
                  style={[styles.rowText, styles.cancelText, { color: theme.textSecondary }]}>
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText themeColor="textSecondary" style={styles.title}>
                {t('post.repost')}
              </ThemedText>

              <View style={[styles.inputWrap, { backgroundColor: theme.bgSecondary }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('postDetail.sharePlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  maxLength={DESCRIPTION_MAX}
                  autoFocus
                />
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { borderColor: theme.border },
                    pressed && { backgroundColor: theme.bgHover },
                  ]}
                  onPress={close}>
                  <ThemedText style={[styles.btnText, { color: theme.textSecondary }]}>
                    {t('common.cancel')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: theme.primary, borderColor: theme.primary },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={submitRepost}>
                  <ThemedText style={[styles.btnText, styles.btnPrimaryText]}>
                    {t('post.repost')}
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing.xl,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowText: {
    ...Typography.body,
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  cancelRow: {
    justifyContent: 'center',
  },
  cancelText: {
    fontWeight: '600',
  },
  inputWrap: {
    marginHorizontal: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  input: {
    ...Typography.body,
    fontSize: 15,
    minHeight: 80,
    paddingVertical: Spacing.xs,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: 600,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
  },
});
