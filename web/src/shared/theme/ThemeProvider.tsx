import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  APP_THEME_STORAGE_KEY,
  applyCatalogTheme,
  CATALOG_THEME_METAS,
  getCatalogTheme,
  normalizeCatalogThemeId,
  readStoredCatalogThemeId,
  type CatalogTheme,
} from './catalogTheme';

export type ThemeCtx = {
  themeId: string;
  theme: CatalogTheme;
  themes: readonly CatalogTheme[];
  setThemeId: (id: string) => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

function applyThemeById(id: string) {
  const theme = getCatalogTheme(id);
  if (theme) applyCatalogTheme(theme, id);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeState] = useState<string>(() => readStoredCatalogThemeId());

  const theme = useMemo(() => getCatalogTheme(themeId) ?? CATALOG_THEME_METAS[0]!.theme, [themeId]);

  useEffect(() => {
    applyThemeById(themeId);
    try {
      localStorage.setItem(APP_THEME_STORAGE_KEY, themeId);
    } catch {
      /* ignore */
    }
  }, [themeId]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === APP_THEME_STORAGE_KEY && e.newValue != null) {
        setThemeState(normalizeCatalogThemeId(e.newValue));
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setThemeId = useCallback((id: string) => {
    setThemeState(normalizeCatalogThemeId(id));
  }, []);

  const value = useMemo(
    () => ({
      themeId,
      theme,
      themes: CATALOG_THEME_METAS.map((m) => m.theme),
      setThemeId,
    }),
    [themeId, theme, setThemeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}
