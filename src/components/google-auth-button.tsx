import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { googleLogin } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

/** Mã lỗi backend (errors/messages.go) → key dịch trong locales. */
const ERROR_KEYS: Record<string, string> = {
  'auth.GOOGLE_NOT_CONFIGURED': 'auth.google.notConfigured',
  'auth.INVALID_GOOGLE_TOKEN': 'auth.google.invalidToken',
  'auth.GOOGLE_ACCOUNT_MISMATCH': 'auth.google.mismatch',
  'auth.REGISTRATION_DISABLED': 'auth.google.registrationDisabled',
  'auth.ACCOUNT_INACTIVE': 'auth.google.inactive',
};

let configured = false;

/**
 * Configure 1 lần trước signIn. webClientId (Google client ID dạng Web)
 * quyết định audience của idToken — backend chỉ cho phép id trong
 * GOOGLE_CLIENT_IDS, nên phải là client ID Web hiện có.
 */
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

export default function GoogleAuthButton() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      ensureConfigured();
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const result = await GoogleSignin.signIn();
      // User huỷ → im lặng
      if (result.type !== 'success') return;

      const idToken = result.data.idToken;
      if (!idToken) {
        Alert.alert(t('auth.google.failed'), t('auth.google.missingToken'));
        return;
      }

      const res = await googleLogin(idToken);
      await signIn(res);
      router.replace('/(drawer)' as any);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) return;

      const raw = err instanceof Error ? err.message : '';
      const key = ERROR_KEYS[raw];
      Alert.alert(t('auth.google.failed'), key ? t(key) : raw || t('auth.google.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <ThemedText themeColor="textSecondary" style={styles.dividerText}>
          {t('auth.google.divider')}
        </ThemedText>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
      </View>

      <Pressable
        onPress={handlePress}
        disabled={loading}
        style={({ pressed }) => [
          styles.button,
          { borderColor: theme.border, backgroundColor: theme.card },
          pressed && !loading && styles.pressed,
          loading && styles.disabled,
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <>
            <MaterialCommunityIcons name="google" size={20} color={theme.text} />
            <ThemedText style={styles.label}>{t('auth.google.button')}</ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...Typography.caption,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  label: {
    ...Typography.body,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
