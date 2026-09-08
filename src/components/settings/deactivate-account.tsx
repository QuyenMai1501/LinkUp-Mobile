import { useState } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { deactivateAccount } from '@/api/settings';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/spacing';

export default function DeactivateAccount() {
  const colors = useTheme();
  const { signOut } = useAuth();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeactivate = async () => {
    if (!password) {
      Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu để xác nhận');
      return;
    }

    Alert.alert(
      'Xác nhận',
      'Bạn có chắc muốn vô hiệu hóa tài khoản? Hành động này không thể hoàn tác.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Vô hiệu hóa',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deactivateAccount(password);
              Alert.alert('Thành công', 'Tài khoản đã bị vô hiệu hóa');
              signOut();
            } catch (err) {
              Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể vô hiệu hóa tài khoản');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={[styles.warningBox, { backgroundColor: colors.dangerLight }]}>
        <ThemedText style={styles.warningIcon}>⚠️</ThemedText>
        <ThemedText style={styles.warningText}>
          Khi vô hiệu hóa tài khoản, tất cả dữ liệu sẽ bị ẩn và bạn không thể đăng nhập lại.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText style={styles.label}>Nhập mật khẩu để xác nhận</ThemedText>
        <ThemedView style={[styles.inputWrapper, { backgroundColor: colors.bgSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Mật khẩu"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
        </ThemedView>
      </ThemedView>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.danger }]}
        onPress={handleDeactivate}
        disabled={loading}
        activeOpacity={0.8}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Vô hiệu hóa tài khoản</ThemedText>
        )}
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  warningBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  warningIcon: { fontSize: 20 },
  warningText: { flex: 1, fontSize: 14, lineHeight: 20 },
  field: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '600' },
  inputWrapper: {
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 48,
    justifyContent: 'center',
  },
  input: { fontSize: 16 },
  button: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
