export const APP_THEME_STORAGE_KEY = 'billing.workspace.theme';

export const APP_THEME_IDS = ['midnight', 'charcoal', 'ocean', 'sunset', 'violet', 'paper'] as const;

export type AppThemeId = (typeof APP_THEME_IDS)[number];

export type AppThemeMeta = {
  id: AppThemeId;
  label: string;
  description: string;
};

export const APP_THEME_METAS: readonly AppThemeMeta[] = [
  { id: 'midnight', label: 'Midnight', description: 'Deep blue-black shell — original workspace look.' },
  { id: 'charcoal', label: 'Charcoal', description: 'Neutral zinc tones, minimal distraction.' },
  { id: 'ocean', label: 'Ocean', description: 'Cool teal accents on a deep navy base.' },
  { id: 'sunset', label: 'Sunset', description: 'Warm amber accents for high-energy sessions.' },
  { id: 'violet', label: 'Violet', description: 'Indigo and violet highlights.' },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Light shell like classic accounting apps; dark cards keep existing screens readable.',
  },
];

export function normalizeAppThemeId(raw: string | null | undefined): AppThemeId {
  const s = raw?.trim().toLowerCase();
  if (s && (APP_THEME_IDS as readonly string[]).includes(s)) return s as AppThemeId;
  return 'midnight';
}

export function readStoredAppThemeId(): AppThemeId {
  try {
    return normalizeAppThemeId(localStorage.getItem(APP_THEME_STORAGE_KEY));
  } catch {
    return 'midnight';
  }
}
