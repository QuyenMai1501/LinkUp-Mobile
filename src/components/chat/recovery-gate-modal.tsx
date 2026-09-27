import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

// Cổng khôi phục khóa E2E trên thiết bị mới: chặn hydrate danh sách hội thoại
// (nội dung giải mã ra rỗng) cho tới khi người dùng mở khóa bằng PIN/recovery
// key hoặc bấm Bỏ qua. Bấm nền mờ = Bỏ qua (giống Web đóng Modal).
interface Props {
  visible: boolean;
  busy: boolean;
  secret: string;
  kind: 'pin' | 'recovery';
  error: string | null;
  onChangeSecret: (value: string) => void;
  onChangeKind: (kind: 'pin' | 'recovery') => void;
  onUnlock: () => void;
  onSkip: () => void;
}

export function RecoveryGateModal({
  visible,
  busy,
  secret,
  kind,
  error,
  onChangeSecret,
  onChangeKind,
  onUnlock,
  onSkip,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onSkip}>
      <Pressable style={styles.backdrop} onPress={onSkip}>
        <Pressable style={[styles.card, { backgroundColor: theme.card }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.titleRow}>
            <Icon name="lock" size={18} color={theme.primary} />
            <ThemedText style={styles.title}>{t('chat.recovery.gateTitle')}</ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {t('chat.recovery.gateSubtitle')}
          </ThemedText>

          <View style={[styles.tabs, { backgroundColor: theme.bgSecondary }]}>
            <Pressable
              style={[styles.tab, kind === 'pin' && [styles.tabActive, { backgroundColor: theme.card }]]}
              onPress={() => onChangeKind('pin')}>
              <ThemedText
                style={[styles.tabText, kind === 'pin' && { color: theme.primary, fontWeight: '600' }]}>
                {t('chat.recovery.pinTab')}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.tab, kind === 'recovery' && [styles.tabActive, { backgroundColor: theme.card }]]}
              onPress={() => onChangeKind('recovery')}>
              <ThemedText
                style={[styles.tabText, kind === 'recovery' && { color: theme.primary, fontWeight: '600' }]}>
                {t('chat.recovery.recoveryTab')}
              </ThemedText>
            </Pressable>
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: theme.bgSecondary, color: theme.text }]}
            value={secret}
            onChangeText={onChangeSecret}
            secureTextEntry={kind === 'pin'}
            keyboardType={kind === 'pin' ? 'numeric' : 'default'}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={
              kind === 'pin' ? t('chat.recovery.pinPlaceholder') : t('chat.recovery.recoveryPlaceholder')
            }
            placeholderTextColor={theme.textSecondary}
          />

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <View style={styles.footer}>
            <Pressable
              style={[styles.btn, styles.btnGhost, { borderColor: theme.border }]}
              onPress={onSkip}>
              <ThemedText style={[styles.btnText, { color: theme.text }]}>
                {t('chat.recovery.skip')}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.btnPrimary,
                { backgroundColor: theme.primary, opacity: !secret.trim() || busy ? 0.5 : 1 },
              ]}
              disabled={!secret.trim() || busy}
              onPress={onUnlock}>
              <ThemedText style={[styles.btnText, { color: '#fff' }]}>
                {busy ? t('common.loading') : t('chat.recovery.unlock')}
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: { ...Typography.h2, fontSize: 17 },
  subtitle: { ...Typography.body, fontSize: 14, lineHeight: 20 },
  tabs: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {},
  tabText: { fontSize: 13 },
  input: {
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: { fontSize: 12, color: '#D32F2F' },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { borderWidth: 1 },
  btnPrimary: {},
  btnText: { fontSize: 15, fontWeight: '600' },
});
