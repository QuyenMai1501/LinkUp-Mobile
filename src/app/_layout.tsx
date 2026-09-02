import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/contexts/auth-context';
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

function RootNavigator() {
  const { scheme } = useThemeMode();

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* @ts-ignore — expo-router linking prop not in types */}
      <Stack screenOptions={{ headerShown: false }} linking={linking}>
        <Stack.Screen name="(tabs)" />
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
        <RootNavigator />
      </AuthProvider>
    </ThemeModeProvider>
  );
}
