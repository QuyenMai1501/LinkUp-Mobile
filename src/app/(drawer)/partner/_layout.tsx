import { Stack } from 'expo-router';

import { Colors } from '@/constants/colors';
import { useThemeMode } from '@/contexts/theme-context';
import { useTranslation } from '@/hooks/useTranslation';

export default function PartnerLayout() {
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
      <Stack.Screen name="packages" options={{ title: t('packages.title') }} />
      <Stack.Screen name="dashboard" options={{ title: t('partner.nav.dashboard') }} />
      <Stack.Screen name="ads" options={{ title: t('partner.ads.title') }} />
      <Stack.Screen name="ad-form" options={{ title: t('partner.ads.create') }} />
      <Stack.Screen name="ad-analytics" options={{ title: t('partner.analytics.title') }} />
    </Stack>
  );
}
