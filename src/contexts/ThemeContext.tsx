import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, isThemeId } from '../themes/config';
import type { ThemeId } from '../themes/types';

const STORAGE_KEY = 'stayloop-demo-theme';

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readThemeFromUrl(): ThemeId | null {
  const params = new URLSearchParams(window.location.search);
  const value = params.get('theme');
  return isThemeId(value) ? value : null;
}

function persistTheme(theme: ThemeId) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures in private browsing.
  }
}

function syncThemeQueryParam(theme: ThemeId) {
  const url = new URL(window.location.href);
  url.searchParams.set('theme', theme);
  window.history.replaceState({}, '', url.toString());
}

function applyThemeToDocument(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Resolve from the URL param or fall back to the default (current) look.
  // We intentionally do NOT read persisted storage on load, so the live site
  // always shows the default theme for normal visitors; demo themes are opted
  // into explicitly via /demo or a ?theme= link.
  const [theme, setThemeState] = useState<ThemeId>(() => {
    return readThemeFromUrl() || DEFAULT_THEME;
  });

  const setTheme = (next: ThemeId) => {
    setThemeState(next);
    applyThemeToDocument(next);
    persistTheme(next);
    syncThemeQueryParam(next);
  };

  useEffect(() => {
    applyThemeToDocument(theme);
    persistTheme(theme);

    const fromUrl = readThemeFromUrl();
    if (fromUrl && fromUrl !== theme) {
      setThemeState(fromUrl);
    }
    // Do not write the theme into the URL for normal visitors; the param is only
    // added when a theme is explicitly chosen (setTheme) or already present in a
    // demo link. This keeps production URLs clean and hides the demo switcher.
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
