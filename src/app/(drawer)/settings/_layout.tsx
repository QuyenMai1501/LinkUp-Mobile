import { Stack } from 'expo-router';
import { useThemeMode } from '@/contexts/theme-context';
import { Colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useTranslation';

export default function SettingsLayout() {
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ title: t('settings.items.changePassword.label') }} />
      <Stack.Screen name="privacy" options={{ title: t('settings.items.privacy.label') }} />
      <Stack.Screen name="storage" options={{ title: t('settings.items.storage.label') }} />
      <Stack.Screen name="appearance" options={{ title: t('settings.items.appearance.label') }} />
      <Stack.Screen name="sessions" options={{ title: t('settings.items.sessions.label') }} />
      <Stack.Screen name="notifications" options={{ title: t('settings.items.notifications.label') }} />
      <Stack.Screen name="deactivate" options={{ title: t('settings.items.deactivate.label') }} />
    </Stack>
  );
}
