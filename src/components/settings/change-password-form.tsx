import { useState } from 'react';
import {
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { changePassword } from '@/api/auth';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/spacing';
import { useTranslation } from '@/hooks/useTranslation';

interface FieldErrors {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export default function ChangePasswordForm() {
  const colors = useTheme();
  const { t } = useTranslation();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!oldPassword) {
      errors.oldPassword = t('settings.changePassword.validation.currentRequired');
    }

    if (!newPassword) {
      errors.newPassword = t('settings.changePassword.validation.newRequired');
    } else if (newPassword.length < 8) {
      errors.newPassword = t('settings.changePassword.validation.newMin');
    } else if (newPassword.length > 50) {
      errors.newPassword = t('settings.changePassword.validation.newMax');
    } else if (
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      errors.newPassword = t('settings.changePassword.validation.newPattern');
    }

    if (newPassword && newPassword === oldPassword) {
      errors.newPassword = t('settings.changePassword.validation.newSame');
    }

    if (!confirmPassword) {
      errors.confirmPassword = t('settings.changePassword.validation.confirmRequired');
    } else if (confirmPassword !== newPassword) {
      errors.confirmPassword = t('settings.changePassword.validation.confirmMismatch');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await changePassword(oldPassword, newPassword);
      Alert.alert(t('common.success'), res.message || t('settings.changePassword.changeSuccess'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFieldErrors({});
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('settings.changePassword.changeFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.field}>
        <ThemedText style={styles.label}>{t('settings.changePassword.currentPassword')}</ThemedText>
        <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry={!showOld}
            placeholder={t('settings.changePassword.currentPasswordPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowOld(!showOld)} style={styles.eyeBtn}>
            <ThemedText>{showOld ? '🙈' : '👁️'}</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        {fieldErrors.oldPassword && (
          <ThemedText style={styles.error}>{fieldErrors.oldPassword}</ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText style={styles.label}>{t('settings.changePassword.newPassword')}</ThemedText>
        <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNew}
            placeholder={t('settings.changePassword.newPasswordPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
            <ThemedText>{showNew ? '🙈' : '👁️'}</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        {fieldErrors.newPassword && (
          <ThemedText style={styles.error}>{fieldErrors.newPassword}</ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText style={styles.label}>{t('settings.changePassword.confirmPassword')}</ThemedText>
        <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
            placeholder={t('settings.changePassword.confirmPasswordPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
            <ThemedText>{showConfirm ? '🙈' : '👁️'}</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        {fieldErrors.confirmPassword && (
          <ThemedText style={styles.error}>{fieldErrors.confirmPassword}</ThemedText>
        )}
      </ThemedView>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.8}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>{t('settings.changePassword.changeButton')}</ThemedText>
        )}
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  field: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  input: { flex: 1, fontSize: 16 },
  eyeBtn: { paddingLeft: Spacing.sm },
  error: { fontSize: 12, color: '#D32F2F', marginTop: 2 },
  button: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
