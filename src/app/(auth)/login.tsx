import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { login } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { FormTextInput } from '@/components/ui/form-text-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      await signIn(res);
      router.replace('/index');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Đăng nhập thất bại';
      Alert.alert('Đăng nhập thất bại', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Image
                source={require('@/assets/images/S-Logo-Rmbg.png')}
                style={styles.logo}
                contentFit="contain"
              />
              <ThemedText style={styles.title}>Đăng nhập</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Chào mừng bạn quay lại LinkUp
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

              <FormTextInput
                label="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
              />

              <Pressable onPress={() => router.push('/forgot-password')}>
                <ThemedText themeColor="primary" style={styles.forgot}>
                  Quên mật khẩu?
                </ThemedText>
              </Pressable>

              <Button label="Đăng nhập" onPress={handleSubmit} loading={loading} />

              <View style={styles.footerRow}>
                <ThemedText themeColor="textSecondary">Chưa có tài khoản?</ThemedText>
                <Pressable onPress={() => router.push('/register')}>
                  <ThemedText themeColor="primary" style={styles.footerLink}>
                    Đăng ký
                  </ThemedText>
                </Pressable>
              </View>
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
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  logo: {
    width: 64,
    height: 64,
    alignSelf: 'center',
  },
  title: {
    ...Typography.h1,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  forgot: {
    ...Typography.body,
    alignSelf: 'flex-end',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  footerLink: {
    ...Typography.body,
    fontWeight: 700,
  },
});
