import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { verifyEmail, resendVerification, decodeToken } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { FormTextInput } from '@/components/ui/form-text-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

type Status = 'verifying' | 'pending' | 'success' | 'error';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function VerifyEmailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();

  const initialToken = params.token ?? null;
  const initialEmail = params.email ?? null;

  const [status, setStatus] = useState<Status>(initialToken ? 'verifying' : 'pending');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      cooldownRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown]);

  useEffect(() => {
    if (!initialToken) return;

    let cancelled = false;
    const run = async () => {
      try {
        const res = await verifyEmail(initialToken);
        if (cancelled) return;
        if (!res.verified) {
          setMessage(res.message);
          setStatus('error');
          return;
        }
        if (res.access_token && res.refresh_token) {
          const payload = decodeToken(res.access_token)
          await signIn({
            user: {
              id: payload?.user_id ?? '',
              username: '',
              email: payload?.email ?? (email || ''),
              status: 'active',
              created_at: '',
            },
            tokens: {
              access_token: res.access_token,
              refresh_token: res.refresh_token,
              token_type: 'Bearer',
              expires_in: 900,
              refresh_ttl_in: 604800,
            },
          });
        }
        setStatus('success');
        setTimeout(() => {
          if (!cancelled) router.replace('/(drawer)' as any);
        }, 3000);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        setMessage(msg);
        setStatus('error');
      }
    };
    run();
    return () => { cancelled = true; };
  }, [initialToken]);

  const handleResend = async () => {
    const target = email.trim();
    if (!target) {
      Alert.alert('Lỗi', 'Vui lòng nhập email');
      return;
    }
    if (!EMAIL_REGEX.test(target)) {
      Alert.alert('Lỗi', 'Email không hợp lệ');
      return;
    }
    setResendLoading(true);
    try {
      const res = await resendVerification(target);
      Alert.alert('Thành công', res.message || 'Đã gửi lại email xác minh');
      setCooldown(60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gửi lại thất bại';
      Alert.alert('Lỗi', msg);
    } finally {
      setResendLoading(false);
    }
  };

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

              {status === 'verifying' && (
                <>
                  <ThemedText style={styles.icon}>⏳</ThemedText>
                  <ThemedText style={styles.title}>Đang xác minh</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                    Vui lòng chờ trong giây lát...
                  </ThemedText>
                </>
              )}

              {status === 'pending' && (
                <>
                  <ThemedText style={styles.icon}>📧</ThemedText>
                  <ThemedText style={styles.title}>Xác minh email</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                    Chúng tôi đã gửi liên kết xác minh đến{' '}
                    <ThemedText style={styles.strong}>{email || '—'}</ThemedText>.
                    Vui lòng kiểm tra hộp thư của bạn.
                  </ThemedText>

                  <ThemedText themeColor="textSecondary" style={styles.hint}>
                    Không nhận được email? Kiểm tra thư rác hoặc gửi lại bên dưới.
                  </ThemedText>

                  <FormTextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />

                  <Button
                    label={cooldown > 0 ? `Gửi lại (${cooldown}s)` : 'Gửi lại email xác minh'}
                    onPress={handleResend}
                    loading={resendLoading}
                    disabled={cooldown > 0}
                  />

                  <Pressable onPress={() => router.replace('/login')}>
                    <ThemedText themeColor="primary" style={styles.backLink}>
                      Về trang đăng nhập
                    </ThemedText>
                  </Pressable>
                </>
              )}

              {status === 'success' && (
                <>
                  <ThemedText style={styles.icon}>✅</ThemedText>
                  <ThemedText style={styles.title}>Xác minh thành công</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                    {message || 'Email đã được xác minh thành công. Đang chuyển trang...'}
                  </ThemedText>
                </>
              )}

              {status === 'error' && (
                <>
                  <ThemedText style={styles.icon}>❌</ThemedText>
                  <ThemedText style={styles.title}>Xác minh thất bại</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                    {message || 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.'}
                  </ThemedText>

                  <ThemedText themeColor="textSecondary" style={styles.hint}>
                    Vui lòng nhập email để gửi lại liên kết xác minh.
                  </ThemedText>

                  <FormTextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />

                  <Button
                    label={cooldown > 0 ? `Gửi lại (${cooldown}s)` : 'Gửi lại email xác minh'}
                    onPress={handleResend}
                    loading={resendLoading}
                    disabled={cooldown > 0}
                  />

                  <Pressable onPress={() => router.replace('/login')}>
                    <ThemedText themeColor="primary" style={styles.backLink}>
                      Về trang đăng nhập
                    </ThemedText>
                  </Pressable>
                </>
              )}
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
  icon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h1,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  strong: {
    fontWeight: 700,
  },
  hint: {
    ...Typography.caption,
    textAlign: 'center',
  },
  backLink: {
    ...Typography.body,
    fontWeight: 700,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
