import { createContext, type PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { type ResolvedColorScheme, type ThemeColors, themeColors } from './colors';
import { type ThemeMode, useThemeStore } from './themeStore';

type AppTheme = {
  themeMode: ThemeMode;
  resolvedScheme: ResolvedColorScheme;
  colors: ThemeColors;
  setThemeMode: (themeMode: ThemeMode) => void;
};

const ThemeContext = createContext<AppTheme | null>(null);

export function resolveColorScheme(
  themeMode: ThemeMode,
  systemColorScheme: 'light' | 'dark' | null | undefined,
): ResolvedColorScheme {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  return systemColorScheme === 'dark' ? 'dark' : 'light';
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const themeMode = useThemeStore((state) => state.themeMode);
  const setThemeMode = useThemeStore((state) => state.setThemeMode);
  const resolvedScheme = resolveColorScheme(themeMode, systemColorScheme);

  const value = useMemo<AppTheme>(
    () => ({
      themeMode,
      resolvedScheme,
      colors: themeColors[resolvedScheme],
      setThemeMode,
    }),
    [resolvedScheme, setThemeMode, themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useAppTheme must be used inside AppThemeProvider');
  }

  return theme;
}
