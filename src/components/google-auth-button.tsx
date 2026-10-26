import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { showAlert } from '@/utils/alert';
import { googleLogin } from '@/api/auth';
import { apiErrorMessage } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';

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
        showAlert(t('auth.google.failed'), t('auth.google.missingToken'));
        return;
      }

      const res = await googleLogin(idToken);
      await signIn(res);
      router.replace('/(drawer)' as any);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) return;

      showAlert(t('auth.google.failed'), apiErrorMessage(err, t('auth.google.failed')));
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
            <Image
              source={require('@/assets/images/google-g.png')}
              style={styles.googleIcon}
              contentFit="contain"
            />
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
  googleIcon: {
    width: 20,
    height: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
