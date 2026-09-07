import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

type ThemeMode = 'light' | 'dark';

type ThemeModeContextValue = {
  scheme: ThemeMode;
  setScheme: (scheme: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [scheme, setScheme] = useState<ThemeMode>(systemScheme === 'dark' ? 'dark' : 'light');

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      scheme,
      setScheme,
      toggleTheme: () => setScheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [scheme],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);
  const systemScheme = useColorScheme();

  if (context) {
    return context;
  }

  return {
    scheme: systemScheme === 'dark' ? 'dark' : 'light',
    setScheme: () => {},
    toggleTheme: () => {},
  };
}
