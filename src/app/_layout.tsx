import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ThemeModeProvider, useThemeMode } from '@/contexts/theme-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { scheme } = useThemeMode();

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppTabs />
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <ThemeModeProvider>
      <AnimatedSplashOverlay />
      <RootNavigator />
    </ThemeModeProvider>
  );
}
