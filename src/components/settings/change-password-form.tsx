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

interface FieldErrors {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export default function ChangePasswordForm() {
  const colors = useTheme();

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
      errors.oldPassword = 'Vui lòng nhập mật khẩu hiện tại';
    }

    if (!newPassword) {
      errors.newPassword = 'Vui lòng nhập mật khẩu mới';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Mật khẩu phải có ít nhất 8 ký tự';
    } else if (newPassword.length > 50) {
      errors.newPassword = 'Mật khẩu không được quá 50 ký tự';
    } else if (
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      errors.newPassword = 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt';
    }

    if (newPassword && newPassword === oldPassword) {
      errors.newPassword = 'Mật khẩu mới không được trùng mật khẩu cũ';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (confirmPassword !== newPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await changePassword(oldPassword, newPassword);
      Alert.alert('Thành công', res.message || 'Đổi mật khẩu thành công');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFieldErrors({});
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.field}>
        <ThemedText style={styles.label}>Mật khẩu hiện tại</ThemedText>
        <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry={!showOld}
            placeholder="Nhập mật khẩu hiện tại"
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
        <ThemedText style={styles.label}>Mật khẩu mới</ThemedText>
        <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNew}
            placeholder="Nhập mật khẩu mới"
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
        <ThemedText style={styles.label}>Xác nhận mật khẩu</ThemedText>
        <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
            placeholder="Nhập lại mật khẩu mới"
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
          <ThemedText style={styles.buttonText}>Đổi mật khẩu</ThemedText>
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
