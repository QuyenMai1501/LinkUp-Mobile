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

import { forgotPassword } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { FormTextInput } from '@/components/ui/form-text-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    const target = email.trim();

    if (!target) {
      setFieldError(t('auth.forgotPassword.emailLabel'));
      return;
    }
    if (!EMAIL_REGEX.test(target)) {
      setFieldError(t('auth.register.validation.emailInvalid'));
      return;
    }

    setFieldError(undefined);
    setLoading(true);
    try {
      await forgotPassword(target);
      setSentEmail(target);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.forgotPassword.sendFailed');
      Alert.alert(t('auth.forgotPassword.title'), message);
    } finally {
      setLoading(false);
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

              {sentEmail ? (
                <>
                  <ThemedText style={styles.title}>{t('auth.forgotPassword.emailSent')}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                    {t('auth.forgotPassword.emailSentMessage')}{' '}
                    <ThemedText style={styles.strong}>{sentEmail}</ThemedText>
                  </ThemedText>
                  <Button label={t('auth.forgotPassword.backToLogin')} onPress={() => router.replace('/login')} />
                </>
              ) : (
                <>
                  <ThemedText style={styles.title}>{t('auth.forgotPassword.title')}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                    {t('auth.forgotPassword.subtitle')}
                  </ThemedText>

                  <FormTextInput
                    label={t('auth.forgotPassword.emailLabel')}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      if (fieldError) setFieldError(undefined);
                    }}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    error={fieldError}
                  />

                  <Button label={t('auth.forgotPassword.sendButton')} onPress={handleSubmit} loading={loading} />

                  <Pressable onPress={() => router.replace('/login')}>
                    <ThemedText themeColor="primary" style={styles.backToLogin}>
                      {t('auth.forgotPassword.backToLogin')}
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
  backToLogin: {
    ...Typography.body,
    fontWeight: 700,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
