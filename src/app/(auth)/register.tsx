import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { register } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { FormTextInput } from '@/components/ui/form-text-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!displayName.trim()) {
      errors.displayName = 'Vui lòng nhập tên hiển thị';
    } else if (Array.from(displayName.trim()).length < 3) {
      errors.displayName = 'Tên hiển thị phải có ít nhất 3 ký tự';
    } else if (Array.from(displayName.trim()).length > 55) {
      errors.displayName = 'Tên hiển thị không được vượt quá 55 ký tự';
    }

    if (!email.trim()) {
      errors.email = 'Vui lòng nhập email';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Email không hợp lệ';
    }

    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 8) {
      errors.password = 'Mật khẩu phải có ít nhất 8 ký tự';
    } else if (password.length > 50) {
      errors.password = 'Mật khẩu không được vượt quá 50 ký tự';
    } else if (
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      errors.password = 'Mật khẩu phải gồm chữ hoa, chữ thường, số và ký tự đặc biệt';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Vui lòng nhập lại mật khẩu';
    } else if (confirmPassword !== password) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await register(displayName.trim(), email.trim(), password);

      if (res.verify_email) {
        setVerifiedEmail(email.trim());
        return;
      }

      if (res.tokens) {
        await signIn({ user: res.user, tokens: res.tokens, storage: res.storage });
        router.replace('/index');
        return;
      }

      router.replace('/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Đăng ký thất bại';
      Alert.alert('Đăng ký thất bại', message);
    } finally {
      setLoading(false);
    }
  };

  if (verifiedEmail) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.logoRow}>
              <Image
                source={require('@/assets/images/S-Logo-Rmbg.png')}
                style={styles.logo}
                contentFit="contain"
              />
              <ThemedText style={[styles.logoText, { color: theme.primary }]}>LinkUp</ThemedText>
            </View>
            <ThemedText style={styles.title}>Kiểm tra email</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Chúng tôi đã gửi liên kết xác thực đến {verifiedEmail}. Vui lòng kiểm tra hộp thư để
              hoàn tất đăng ký.
            </ThemedText>
            <Button label="Về trang đăng nhập" onPress={() => router.replace('/login')} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={60}
          style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
              <View style={styles.logoRow}>
                <Image
                  source={require('@/assets/images/S-Logo-Rmbg.png')}
                  style={styles.logo}
                  contentFit="contain"
                />
                <ThemedText style={[styles.logoText, { color: theme.primary }]}>LinkUp</ThemedText>
              </View>
              <ThemedText style={styles.title}>Tạo tài khoản</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Tham gia LinkUp và kết nối với bạn bè
              </ThemedText>

              <FormTextInput
                label="Tên hiển thị"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Nguyễn Văn A"
                error={fieldErrors.displayName}
                autoComplete="name"
              />

              <FormTextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={fieldErrors.email}
              />

              <FormTextInput
                label="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                placeholder="Ít nhất 8 ký tự"
                secureTextEntry
                error={fieldErrors.password}
              />

              <FormTextInput
                label="Xác nhận mật khẩu"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu"
                secureTextEntry
                error={fieldErrors.confirmPassword}
              />

              <Button label="Đăng ký" onPress={handleSubmit} loading={loading} />

              <View style={styles.footerRow}>
                <ThemedText themeColor="textSecondary">Đã có tài khoản?</ThemedText>
                <Pressable onPress={() => router.push('/login')}>
                  <ThemedText themeColor="primary" style={styles.footerLink} numberOfLines={1}>
                    Đăng nhập
                  </ThemedText>
                </Pressable>
              </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  logo: {
    width: 48,
    height: 48,
  },
  logoText: {
    ...Typography.h2,
  },
  title: {
    ...Typography.h1,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  footerLink: {
    ...Typography.body,
    fontWeight: 700,
  },
});
