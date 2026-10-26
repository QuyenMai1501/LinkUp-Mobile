import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { communityErrorText, joinCommunity } from '@/api/communities';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

interface JoinCodeModalProps {
  visible: boolean;
  communityId: string;
  communityName: string;
  onClose: () => void;
  /** pending = có request_id trong response (chờ duyệt), không hard-code như Web. */
  onJoined: (status: 'member' | 'pending') => void;
}

/** Nhập mã tham gia cộng đồng — server yêu cầu đúng 6 ký tự [A-Z0-9]. */
export function JoinCodeModal({
  visible,
  communityId,
  communityName,
  onClose,
  onJoined,
}: JoinCodeModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = useCallback(() => {
    if (loading) return;
    setCode('');
    setError(null);
    onClose();
  }, [loading, onClose]);

  const handleSubmit = useCallback(async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError(t('communities.codeRequired'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await joinCommunity(communityId, normalized);
      setCode('');
      onClose();
      onJoined(res.request_id ? 'pending' : 'member');
    } catch (err) {
      setError(communityErrorText(err, t('communities.joinError')));
    } finally {
      setLoading(false);
    }
  }, [code, communityId, onClose, onJoined, t]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.centerWrap}>
          <Pressable style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.titleRow}>
              <Icon name="key" size={20} color={theme.primary} />
              <ThemedText style={styles.title}>{t('communities.enterCodeTitle')}</ThemedText>
            </View>

            <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.communityName}>
              {communityName}
            </ThemedText>

            <TextInput
              style={[
                styles.codeInput,
                {
                  backgroundColor: theme.bgSecondary,
                  borderColor: error ? theme.danger : theme.border,
                  color: theme.text,
                },
              ]}
              value={code}
              onChangeText={(v) => {
                setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                if (error) setError(null);
              }}
              placeholder={t('communities.codePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              autoFocus
              editable={!loading}
            />

            {error ? (
              <ThemedText style={[styles.feedback, { color: theme.danger }]}>{error}</ThemedText>
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.feedback}>
                {t('communities.codeHint')}
              </ThemedText>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={handleClose}
                disabled={loading}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  { borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.cancelText}>{t('common.cancel')}</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => void handleSubmit()}
                disabled={loading || !code.trim()}
                style={({ pressed }) => [
                  styles.submitBtn,
                  { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 },
                  pressed && styles.pressed,
                ]}>
                {loading ? (
                  <ActivityIndicator size="small" color={theme.textOnPrimary} />
                ) : (
                  <ThemedText style={[styles.submitText, { color: theme.textOnPrimary }]}>{t('communities.join')}</ThemedText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  centerWrap: {
    width: '100%',
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    fontSize: 18,
  },
  communityName: {
    ...Typography.body,
    fontWeight: '600',
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  feedback: {
    ...Typography.caption,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
  },
  cancelText: {
    ...Typography.body,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  submitText: {
    ...Typography.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
