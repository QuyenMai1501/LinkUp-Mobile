import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import { useTranslation } from '@/hooks/useTranslation';
import { useE2ERecovery, isValidPin } from '@/hooks/useE2ERecovery';

// Quản lý khôi phục khóa chat E2E (mã hóa đầu-cuối): bật = chọn PIN rồi server
// lưu backup khóa chat của máy này ở dạng mã hóa; recovery key hiện ĐÚNG MỘT
// LẦN để người dùng lưu ngoài máy (không bao giờ lưu lên server). Tắt = xóa.
export default function E2ERecoveryForm() {
  const colors = useTheme();
  const { t } = useTranslation();
  const recovery = useE2ERecovery();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirror meta server → state local, nhưng đưa setState sang microtask callback
  // (không setState đồng bộ trong effect body → react-hooks/set-state-in-effect).
  useEffect(() => {
    if (recovery.meta === null) return;
    const meta = recovery.meta;
    void Promise.resolve().then(() => {
      setEnabled(meta.has_blob);
    });
  }, [recovery.meta]);

  const pinInvalid = pin.length > 0 && !isValidPin(pin);
  const mismatch = pinConfirm.length > 0 && pin !== pinConfirm;
  const canSave = isValidPin(pin) && pin === pinConfirm && !recovery.busy;

  const translateErr = (err: unknown) =>
    err instanceof Error ? t(err.message) : t('common.error');

  const handleEnable = async () => {
    setError(null);
    if (!canSave) {
      setError(t('userSettings.e2ePinInvalid'));
      return;
    }
    try {
      const { recoveryKey } = await recovery.enableRecovery(pin);
      setRevealedKey(recoveryKey);
      setShowKey(true);
      setPin('');
      setPinConfirm('');
      Alert.alert(t('userSettings.e2eEnabled'));
    } catch (err) {
      setError(translateErr(err));
    }
  };

  // Copy recovery key: mở Share sheet của hệ thống (text có thể dán vào ứng dụng
  // ghi chú / mật khẩu) — tránh phải thêm dependency native clipboard.
  const handleShareKey = async () => {
    if (!revealedKey) return;
    try {
      await Share.share({ message: revealedKey });
    } catch {
      /* user đóng share sheet */
    }
  };

  const handleDisable = async () => {
    try {
      await recovery.disableRecovery();
      setConfirmDisable(false);
      setShowKey(false);
      setRevealedKey(null);
      setEnabled(false);
      Alert.alert(t('userSettings.e2eDisabled'));
    } catch (err) {
      Alert.alert(t('common.error'), translateErr(err));
    }
  };

  const handleManualRefresh = async () => {
    try {
      const ok = await recovery.forceRefreshBackup();
      if (ok) {
        Alert.alert(t('userSettings.e2eRefreshed'));
      } else {
        Alert.alert(t('userSettings.e2eRefreshNoKeys'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), translateErr(err));
    }
  };

  if (enabled === null) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </ThemedView>
    );
  }

  if (enabled) {
    const activeKey = recovery.meta?.has_blob ? recovery.meta : null;
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={[styles.statusCard, { backgroundColor: colors.bgSecondary }]}>
          <Icon name="shield" size={20} color={colors.primary} />
          <ThemedView style={styles.statusInfo}>
            <ThemedText style={styles.label}>{t('userSettings.e2eStatusActive')}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              {activeKey?.updated_at
                ? `${t('userSettings.e2eUpdatedAt')}: ${new Date(activeKey.updated_at).toLocaleString()}`
                : t('userSettings.e2eStatusActiveHint')}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText style={styles.label}>{t('userSettings.e2eChangePin')}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            {t('userSettings.e2eChangePinHint')}
          </ThemedText>
          <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, ''))}
              secureTextEntry
              keyboardType="numeric"
              maxLength={12}
              placeholder="••••••"
              placeholderTextColor={colors.textSecondary}
            />
          </ThemedView>
          <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={pinConfirm}
              onChangeText={(v) => setPinConfirm(v.replace(/\D/g, ''))}
              secureTextEntry
              keyboardType="numeric"
              maxLength={12}
              placeholder="••••••"
              placeholderTextColor={colors.textSecondary}
            />
          </ThemedView>
          {pinInvalid && (
            <ThemedText style={styles.error}>{t('userSettings.e2ePinInvalid')}</ThemedText>
          )}
          {mismatch && (
            <ThemedText style={styles.error}>{t('userSettings.e2ePinMismatch')}</ThemedText>
          )}
          {error && <ThemedText style={styles.error}>{error}</ThemedText>}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.primary }]}
              onPress={handleEnable}
              disabled={!canSave}
              activeOpacity={0.8}>
              {recovery.busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>{t('userSettings.e2eSavePin')}</ThemedText>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonGhost, { borderColor: colors.border }]}
              onPress={handleManualRefresh}
              disabled={recovery.busy}
              activeOpacity={0.8}>
              <ThemedText style={[styles.buttonText, { color: colors.text }]}>
                {t('userSettings.e2eRefreshNow')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>

        <ThemedView style={[styles.dangerZone, { borderTopColor: colors.border }]}>
          <ThemedText style={[styles.label, { color: colors.danger }]}>
            {t('userSettings.e2eDisable')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            {t('userSettings.e2eDisableHint')}
          </ThemedText>
          {!confirmDisable ? (
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger, { backgroundColor: colors.danger }]}
              onPress={() => setConfirmDisable(true)}
              activeOpacity={0.8}>
              <ThemedText style={styles.buttonText}>{t('userSettings.e2eDisable')}</ThemedText>
            </TouchableOpacity>
          ) : (
            <ThemedView style={[styles.confirmBox, { backgroundColor: colors.bgSecondary }]}>
              <ThemedText themeColor="textSecondary" style={styles.hint}>
                {t('userSettings.e2eDisableConfirm')}
              </ThemedText>
              <View style={styles.footerRow}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonGhost, { borderColor: colors.border }]}
                  onPress={() => setConfirmDisable(false)}
                  activeOpacity={0.8}>
                  <ThemedText style={[styles.buttonText, { color: colors.text }]}>
                    {t('common.cancel')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonDanger, { backgroundColor: colors.danger }]}
                  onPress={handleDisable}
                  disabled={recovery.busy}
                  activeOpacity={0.8}>
                  {recovery.busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.buttonText}>{t('userSettings.e2eDisable')}</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </ThemedView>
          )}
        </ThemedView>

        {showKey && revealedKey && (
          <ThemedView style={[styles.keyBox, { backgroundColor: colors.bgSecondary }]}>
            <ThemedText style={styles.label}>{t('userSettings.e2eKeyTitle')}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              {t('userSettings.e2eKeyHint')}
            </ThemedText>
            <ThemedText style={styles.recoveryKeyText} selectable>
              {revealedKey}
            </ThemedText>
            <TouchableOpacity
              style={[styles.button, styles.buttonGhost, { borderColor: colors.border }]}
              onPress={handleShareKey}
              activeOpacity={0.8}>
              <ThemedText style={[styles.buttonText, { color: colors.text }]}>
                {t('userSettings.e2eCopy')}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={[styles.statusCard, { backgroundColor: colors.bgSecondary }]}>
        <Icon name="shield" size={20} color={colors.textSecondary} />
        <ThemedView style={styles.statusInfo}>
          <ThemedText style={styles.label}>{t('userSettings.e2eStatusInactive')}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            {t('userSettings.e2eInactiveHint')}
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText style={styles.label}>{t('userSettings.e2ePinLabel')}</ThemedText>
        <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, ''))}
            secureTextEntry
            keyboardType="numeric"
            maxLength={12}
            placeholder="••••••"
            placeholderTextColor={colors.textSecondary}
          />
        </ThemedView>
        <ThemedText style={styles.label}>{t('userSettings.e2ePinConfirm')}</ThemedText>
        <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={pinConfirm}
            onChangeText={(v) => setPinConfirm(v.replace(/\D/g, ''))}
            secureTextEntry
            keyboardType="numeric"
            maxLength={12}
            placeholder="••••••"
            placeholderTextColor={colors.textSecondary}
          />
        </ThemedView>
        {pinInvalid && (
          <ThemedText style={styles.error}>{t('userSettings.e2ePinInvalid')}</ThemedText>
        )}
        {mismatch && (
          <ThemedText style={styles.error}>{t('userSettings.e2ePinMismatch')}</ThemedText>
        )}
        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.primary }]}
          onPress={handleEnable}
          disabled={!canSave}
          activeOpacity={0.8}>
          {recovery.busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>{t('userSettings.e2eEnable')}</ThemedText>
          )}
        </TouchableOpacity>
      </ThemedView>

      {showKey && revealedKey && (
        <ThemedView style={[styles.keyBox, { backgroundColor: colors.bgSecondary }]}>
          <ThemedText style={styles.label}>{t('userSettings.e2eKeyTitle')}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            {t('userSettings.e2eKeyHint')}
          </ThemedText>
          <ThemedText style={styles.recoveryKeyText} selectable>
            {revealedKey}
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, styles.buttonGhost, { borderColor: colors.border }]}
            onPress={handleShareKey}
            activeOpacity={0.8}>
            <ThemedText style={[styles.buttonText, { color: colors.text }]}>
              {t('userSettings.e2eCopy')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  center: { paddingVertical: Spacing.xl, alignItems: 'center' },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
  },
  statusInfo: { flex: 1, gap: 2 },
  field: { gap: Spacing.sm },
  label: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  input: { flex: 1, fontSize: 16 },
  error: { fontSize: 12, color: '#D32F2F' },
  footerRow: { flexDirection: 'row', gap: Spacing.sm },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  buttonPrimary: {},
  buttonGhost: { borderWidth: 1 },
  buttonDanger: {},
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  dangerZone: {
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
  },
  confirmBox: { gap: Spacing.sm, padding: Spacing.md, borderRadius: 12 },
  keyBox: { gap: Spacing.sm, padding: Spacing.md, borderRadius: 12 },
  recoveryKeyText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
});
