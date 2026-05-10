import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  APP_THEME_STORAGE_KEY,
  type AppThemeId,
  normalizeAppThemeId,
  readStoredAppThemeId,
} from './appThemes';

type ThemeCtx = {
  themeId: AppThemeId;
  setThemeId: (id: AppThemeId) => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

function applyDomTheme(id: AppThemeId) {
  document.documentElement.dataset.appTheme = id;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeState] = useState<AppThemeId>(() => readStoredAppThemeId());

  useEffect(() => {
    applyDomTheme(themeId);
    try {
      localStorage.setItem(APP_THEME_STORAGE_KEY, themeId);
    } catch {
      /* ignore */
    }
  }, [themeId]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === APP_THEME_STORAGE_KEY && e.newValue != null) {
        setThemeState(normalizeAppThemeId(e.newValue));
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setThemeId = useCallback((id: AppThemeId) => {
    setThemeState(normalizeAppThemeId(id));
  }, []);

  const value = useMemo(() => ({ themeId, setThemeId }), [themeId, setThemeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}
