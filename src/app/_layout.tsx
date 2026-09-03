import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useSegments, useRouter } from 'expo-router';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ThemeModeProvider, useThemeMode } from '@/contexts/theme-context';

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
      router.replace('/' as any);
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
        <Stack.Screen name="index" />
        <Stack.Screen name="(drawer)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <AuthRedirect />
        <RootNavigator />
      </AuthProvider>
    </ThemeModeProvider>
  );
}
