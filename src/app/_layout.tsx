import '@/polyfills'; // PHẢI đứng đầu — cấp globalThis.crypto (WebCrypto) cho e2ee.ts

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useSegments, useRouter } from 'expo-router';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CallOverlay } from '@/components/calls/call-overlay';
import { GroupCallIncomingModal } from '@/components/calls/group-call-incoming-modal';
import { GroupCallOverlay } from '@/components/calls/group-call-overlay';
import AlertHost from '@/components/ui/alert-host';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { CallProvider } from '@/contexts/call-context';
import { GroupCallProvider } from '@/contexts/group-call-context';
import { LanguageProvider } from '@/contexts/language-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { ThemeModeProvider, useThemeMode } from '@/contexts/theme-context';
import { markNavigationReady } from '@/utils/notification-navigate';

SplashScreen.preventAutoHideAsync();

const linking = {
  prefixes: ['linkupmobile://'],
  config: {
    screens: {
      '(auth)': {
        screens: {
          'verify-email': 'verify-email',
        },
      },
    },
  },
};

function AuthRedirect() {
  const { isAuthenticated, isRestoring } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isRestoring) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(drawer)' as any);
    }
  }, [isAuthenticated, isRestoring, segments]);

  return null;
}

function RootNavigator() {
  const { scheme } = useThemeMode();

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* @ts-ignore — expo-router linking prop not in types */}
      <Stack screenOptions={{ headerShown: false }} linking={linking}>
        <Stack.Screen name="(drawer)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const router = useRouter();

  // Navigation sẵn sàng → flush route notification bị giữ lại từ cold start
  // (push tap khi app bị kill đến trước khi Root mount).
  useEffect(() => {
    markNavigationReady((route) => {
      (router as any).push(route);
    });
  }, [router]);

  // Selftest DEV: đối chiếu chuỗi E2E với golden vector của Web (xem
  // src/utils/e2ee.selftest.ts). Log PASS/FAIL qua dbg() → log Metro.
  useEffect(() => {
    if (!__DEV__) return;
    void import('@/utils/e2ee.selftest').then((m) => m.runE2EESelfTest());
  }, []);

  return (
    <LanguageProvider>
      <ThemeModeProvider>
        <AuthProvider>
          <NotificationProvider>
            <CallProvider>
              <GroupCallProvider>
                <AnimatedSplashOverlay />
                <AuthRedirect />
                <RootNavigator />
                <CallOverlay />
                <GroupCallOverlay />
                <AlertHost />
                <GroupCallIncomingModal />
              </GroupCallProvider>
            </CallProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeModeProvider>
    </LanguageProvider>
  );
}
