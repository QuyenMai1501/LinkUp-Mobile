import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Colors } from '@/constants/colors';
import { useThemeMode } from '@/contexts/theme-context';
import { useTranslation } from '@/hooks/useTranslation';

export default function PartnerLayout() {
  const { scheme } = useThemeMode();
  const colors = Colors[scheme];
  const { t } = useTranslation();
  const router = useRouter();

  // Exit Partner Hub: về màn trước (settings/feed) nếu có history,
  // cold-start → về feed. MIRROR web navbar dropdown "Trang chủ".
  const exitToApp = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as never);
    }
  };

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        headerRight: () => (
          <TouchableOpacity
            accessibilityLabel={t('partner.nav.exit')}
            activeOpacity={0.7}
            hitSlop={8}
            onPress={exitToApp}>
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        ),
      }}>
      <Stack.Screen name="packages" options={{ title: t('packages.title') }} />
      <Stack.Screen name="dashboard" options={{ title: t('partner.nav.dashboard') }} />
      <Stack.Screen name="ads" options={{ title: t('partner.ads.title') }} />
      <Stack.Screen name="ad-form" options={{ title: t('partner.ads.create') }} />
      <Stack.Screen name="ad-analytics" options={{ title: t('partner.analytics.title') }} />
    </Stack>
  );
}
