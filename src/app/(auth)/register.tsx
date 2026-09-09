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
import { useTranslation } from '@/hooks/useTranslation';

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
  const { t } = useTranslation();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!displayName.trim()) {
      errors.displayName = t('auth.register.validation.nameRequired');
    } else if (Array.from(displayName.trim()).length < 3) {
      errors.displayName = t('auth.register.validation.nameMin');
    } else if (Array.from(displayName.trim()).length > 55) {
      errors.displayName = t('auth.register.validation.nameMax');
    }

    if (!email.trim()) {
      errors.email = t('auth.register.validation.emailRequired');
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = t('auth.register.validation.emailInvalid');
    }

    if (!password) {
      errors.password = t('auth.register.validation.passwordRequired');
    } else if (password.length < 8) {
      errors.password = t('auth.register.validation.passwordMin');
    } else if (password.length > 50) {
      errors.password = t('auth.register.validation.passwordMax');
    } else if (
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      errors.password = t('auth.register.validation.passwordPattern');
    }

    if (!confirmPassword) {
      errors.confirmPassword = t('auth.register.validation.confirmRequired');
    } else if (confirmPassword !== password) {
      errors.confirmPassword = t('auth.register.validation.confirmMismatch');
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
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }

      if (res.tokens) {
        await signIn({ user: res.user, tokens: res.tokens, storage: res.storage });
        router.replace('/(drawer)' as any);
        return;
      }

      router.replace('/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.register.registerFailed');
      Alert.alert(t('auth.register.registerFailed'), message);
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
              <ThemedText style={styles.title}>{t('auth.register.title')}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                {t('auth.register.subtitle')}
              </ThemedText>

              <FormTextInput
                label={t('auth.register.nameLabel')}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={t('auth.register.namePlaceholder')}
                error={fieldErrors.displayName}
                autoComplete="name"
              />

              <FormTextInput
                label={t('auth.register.emailLabel')}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={fieldErrors.email}
              />

              <FormTextInput
                label={t('auth.register.passwordLabel')}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.register.passwordPlaceholder')}
                secureTextEntry
                error={fieldErrors.password}
              />

              <FormTextInput
                label={t('auth.register.confirmPasswordLabel')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('auth.register.confirmPasswordPlaceholder')}
                secureTextEntry
                error={fieldErrors.confirmPassword}
              />

              <Button label={t('auth.register.registerButton')} onPress={handleSubmit} loading={loading} />

              <View style={styles.footerRow}>
                <ThemedText themeColor="textSecondary">{t('auth.register.hasAccount')}</ThemedText>
                <Pressable onPress={() => router.push('/login')}>
                  <ThemedText themeColor="primary" style={styles.footerLink} numberOfLines={1}>
                    {t('auth.register.loginLink')}
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
