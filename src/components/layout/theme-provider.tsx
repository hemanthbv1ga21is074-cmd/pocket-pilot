'use client';

import * as React from 'react';
import type { ThemePreference } from '@/lib/finance/types';

const THEME_STORAGE_KEY = 'pocketpilot_theme';

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>('light');

  const applyTheme = React.useCallback((pref: ThemePreference) => {
    if (typeof window === 'undefined') return;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = pref === 'dark' || (pref === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
    setResolvedTheme(isDark ? 'dark' : 'light');
  }, []);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
      const initial: ThemePreference =
        stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
      setThemeState(initial);
      applyTheme(initial);
    } catch {
      applyTheme('system');
    }
  }, [applyTheme]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme, applyTheme]);

  const setTheme = React.useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Ignore storage errors
      }
      applyTheme(next);
    },
    [applyTheme]
  );

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
