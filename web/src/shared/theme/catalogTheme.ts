import themesJson from './themes.json';

export const APP_THEME_STORAGE_KEY = 'billing.workspace.theme';

function applyContentVars(
  theme: CatalogTheme,
  bg: readonly [number, number, number],
  text: readonly [number, number, number],
  primary: readonly [number, number, number],
  white: readonly [number, number, number],
  black: readonly [number, number, number],
  set: (name: string, rgb: readonly [number, number, number]) => void,
  root: HTMLElement,
): void {
  if (theme.IsDark) {
    const surface = mix(bg, white, 0.12);
    const surface2 = mix(bg, white, 0.07);
    const inputBg = mix(bg, black, 0.28);
    const tableHead = mix(bg, white, 0.06);

    set('--content-fg-rgb', text);
    set('--content-muted-rgb', mix(text, bg, 0.42));
    set('--content-subtle-rgb', mix(text, bg, 0.55));
    set('--content-surface-rgb', surface);
    set('--content-surface-2-rgb', surface2);
    set('--content-surface-hover-rgb', mix(surface, white, 0.08));
    set('--content-border-rgb', white);
    root.style.setProperty('--content-border-alpha', '0.12');
    set('--content-input-bg-rgb', inputBg);
    set('--content-input-fg-rgb', text);
    set('--content-input-border-rgb', white);
    root.style.setProperty('--content-input-border-alpha', '0.14');
    set('--content-input-disabled-bg-rgb', mix(inputBg, black, 0.2));
    set('--content-placeholder-rgb', mix(text, bg, 0.58));
    set('--content-table-head-rgb', tableHead);
    set('--btn-on-primary-rgb', white);
    root.style.setProperty('--content-shadow-alpha', '0.22');
    set('--content-success-bg-rgb', mix(primary, bg, 0.75));
    root.style.setProperty('--content-success-bg-alpha', '0.35');
    set('--content-success-border-rgb', primary);
    set('--content-success-fg-rgb', mix(text, white, 0.15));
  } else {
    const surface = white;
    const surface2 = mix(bg, white, 0.55);
    const inputBg = white;
    const tableHead = mix(bg, black, 0.04);

    set('--content-fg-rgb', text);
    set('--content-muted-rgb', mix(text, bg, 0.45));
    set('--content-subtle-rgb', mix(text, bg, 0.58));
    set('--content-surface-rgb', surface);
    set('--content-surface-2-rgb', surface2);
    set('--content-surface-hover-rgb', mix(bg, white, 0.35));
    set('--content-border-rgb', mix(bg, black, 0.14));
    root.style.setProperty('--content-border-alpha', '1');
    set('--content-input-bg-rgb', inputBg);
    set('--content-input-fg-rgb', text);
    set('--content-input-border-rgb', mix(bg, black, 0.18));
    root.style.setProperty('--content-input-border-alpha', '1');
    set('--content-input-disabled-bg-rgb', mix(bg, white, 0.5));
    set('--content-placeholder-rgb', mix(text, bg, 0.5));
    set('--content-table-head-rgb', tableHead);
    set('--btn-on-primary-rgb', white);
    root.style.setProperty('--content-shadow-alpha', '0.07');
    set('--content-success-bg-rgb', mix(primary, white, 0.88));
    root.style.setProperty('--content-success-bg-alpha', '0.55');
    set('--content-success-border-rgb', primary);
    set('--content-success-fg-rgb', mix(text, black, 0.15));
  }
}

export type CatalogTheme = {
  ThemeId: number;
  ThemeName: string;
  IsDark: boolean;
  PrimaryColor: string;
  SecondaryColor: string;
  BackgroundColor: string;
  TextColor: string;
  FontFamily: string;
  BorderRadius: number;
  ShadowLevel: number;
  IsActive: boolean;
};

export type CatalogThemeMeta = {
  id: string;
  theme: CatalogTheme;
  label: string;
  description: string;
};

export const CATALOG_THEMES = themesJson as CatalogTheme[];

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const CATALOG_THEME_METAS: readonly CatalogThemeMeta[] = CATALOG_THEMES.map((t) => ({
  id: slugify(t.ThemeName),
  theme: t,
  label: t.ThemeName,
  description: t.IsDark
    ? `Dark workspace · ${t.PrimaryColor} accent`
    : `Light shell · ${t.PrimaryColor} accent · dark work panels`,
}));

export const CATALOG_THEME_IDS = CATALOG_THEME_METAS.map((m) => m.id) as readonly string[];

export type CatalogThemeId = (typeof CATALOG_THEME_IDS)[number];

const THEME_BY_ID = new Map(CATALOG_THEME_METAS.map((m) => [m.id, m.theme]));

const DEFAULT_THEME_ID =
  CATALOG_THEME_METAS.find((m) => m.theme.IsActive)?.id ?? CATALOG_THEME_METAS[0]?.id ?? 'dark-pro';

/** Maps legacy workspace theme ids to catalog slugs. */
const LEGACY_THEME_MAP: Record<string, string> = {
  midnight: 'dark-pro',
  charcoal: 'slate-pro',
  ocean: 'ocean-breeze',
  sunset: 'sunrise-soft',
  violet: 'lavender-mist',
  paper: 'arctic-light',
};

export function themeIdFromTheme(theme: CatalogTheme): string {
  return slugify(theme.ThemeName);
}

export function getCatalogTheme(id: string): CatalogTheme | undefined {
  return THEME_BY_ID.get(id);
}

export function getDefaultCatalogThemeId(): string {
  return DEFAULT_THEME_ID;
}

export function normalizeCatalogThemeId(raw: string | null | undefined): string {
  const s = raw?.trim().toLowerCase();
  if (!s) return DEFAULT_THEME_ID;
  if (LEGACY_THEME_MAP[s]) return LEGACY_THEME_MAP[s]!;
  if (THEME_BY_ID.has(s)) return s;
  const byNumeric = CATALOG_THEMES.find((t) => String(t.ThemeId) === s);
  if (byNumeric) return themeIdFromTheme(byNumeric);
  return DEFAULT_THEME_ID;
}

export function readStoredCatalogThemeId(): string {
  try {
    return normalizeCatalogThemeId(localStorage.getItem(APP_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3 ? h.split('').map((c) => c + c).join('') : h.length >= 6 ? h.slice(0, 6) : '0f172a';
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToCss([r, g, b]: readonly [number, number, number]): string {
  return `${r} ${g} ${b}`;
}

function mix(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const SHADOW_OPACITY = [0.12, 0.22, 0.35, 0.5] as const;

export function applyCatalogTheme(theme: CatalogTheme, themeId: string): void {
  const root = document.documentElement;
  const bg = hexToRgb(theme.BackgroundColor);
  const text = hexToRgb(theme.TextColor);
  const primary = hexToRgb(theme.PrimaryColor);
  const secondary = hexToRgb(theme.SecondaryColor);
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];

  const shadowIdx = Math.min(Math.max(theme.ShadowLevel, 0), 3);
  const panelShadow = SHADOW_OPACITY[shadowIdx] ?? 0.35;

  root.dataset.appTheme = themeId;
  root.dataset.themeMode = theme.IsDark ? 'dark' : 'light';
  root.style.colorScheme = theme.IsDark ? 'dark' : 'light';
  root.style.fontFamily = theme.FontFamily;
  root.style.setProperty('--theme-radius', `${theme.BorderRadius}px`);
  root.style.setProperty('--theme-primary', theme.PrimaryColor);
  root.style.setProperty('--theme-secondary', theme.SecondaryColor);

  const set = (name: string, rgb: readonly [number, number, number]) => {
    root.style.setProperty(name, rgbToCss(rgb));
  };

  set('--accent-rgb', primary);
  set('--logo-from-rgb', secondary);
  set('--logo-to-rgb', primary);

  if (theme.IsDark) {
    const sidebar = mix(bg, white, 0.06);
    const panel = mix(bg, white, 0.1);
    const elevated = mix(bg, white, 0.14);
    const navMuted = mix(text, bg, 0.45);

    set('--shell-bg-rgb', bg);
    set('--main-work-bg-rgb', bg);
    set('--sidebar-bg-rgb', sidebar);
    set('--header-bg-rgb', bg);
    root.style.setProperty('--header-bg-alpha', '0.92');
    set('--border-subtle-rgb', white);
    root.style.setProperty('--border-subtle-alpha', '0.1');

    set('--sidebar-title-rgb', text);
    set('--sidebar-tagline-rgb', navMuted);
    set('--nav-section-rgb', navMuted);
    set('--nav-link-rgb', mix(text, bg, 0.35));
    set('--nav-link-hover-rgb', text);
    set('--nav-hover-bg-rgb', white);
    root.style.setProperty('--nav-hover-bg-alpha', '0.06');
    set('--nav-active-fg-rgb', white);
    set('--nav-desc-muted-rgb', mix(text, bg, 0.55));
    set('--nav-desc-active-rgb', mix(text, primary, 0.35));

    set('--title-rgb', text);
    set('--crumb-rgb', navMuted);

    set('--panel-bg-rgb', panel);
    root.style.setProperty('--panel-bg-alpha', '0.96');
    set('--panel-border-rgb', white);
    root.style.setProperty('--panel-border-alpha', '0.1');
    root.style.setProperty('--panel-shadow-opacity', String(panelShadow));

    set('--panel-soft-bg-rgb', white);
    root.style.setProperty('--panel-soft-bg-alpha', '0.04');
    set('--panel-soft-border-rgb', white);
    root.style.setProperty('--panel-soft-border-alpha', '0.09');

    set('--elevated-bg-rgb', elevated);
    set('--elevated-border-rgb', white);
    root.style.setProperty('--elevated-border-alpha', '0.12');
    root.style.setProperty('--elevated-shadow-opacity', String(Math.min(panelShadow + 0.12, 0.58)));

    set('--chip-border-rgb', white);
    root.style.setProperty('--chip-border-alpha', '0.1');
    set('--chip-bg-rgb', white);
    root.style.setProperty('--chip-bg-alpha', '0.05');
    set('--chip-fg-rgb', mix(text, bg, 0.35));

    set('--kbd-bg-rgb', black);
    root.style.setProperty('--kbd-bg-alpha', '0.42');

    set('--elevated-fg-rgb', text);
    set('--elevated-muted-rgb', navMuted);

    applyContentVars(theme, bg, text, primary, white, black, set, root);
  } else {
    const sidebar: [number, number, number] = [255, 255, 255];
    const navMuted = mix(text, bg, 0.5);
    const panel = white;

    set('--shell-bg-rgb', bg);
    set('--main-work-bg-rgb', bg);
    set('--sidebar-bg-rgb', sidebar);
    set('--header-bg-rgb', sidebar);
    root.style.setProperty('--header-bg-alpha', '0.94');
    set('--border-subtle-rgb', mix(bg, black, 0.12));
    root.style.setProperty('--border-subtle-alpha', '1');

    set('--sidebar-title-rgb', text);
    set('--sidebar-tagline-rgb', navMuted);
    set('--nav-section-rgb', navMuted);
    set('--nav-link-rgb', mix(text, bg, 0.35));
    set('--nav-link-hover-rgb', text);
    set('--nav-hover-bg-rgb', bg);
    root.style.setProperty('--nav-hover-bg-alpha', '1');
    set('--nav-active-fg-rgb', white);
    set('--nav-desc-muted-rgb', mix(text, bg, 0.55));
    set('--nav-desc-active-rgb', white);

    set('--title-rgb', text);
    set('--crumb-rgb', navMuted);

    set('--panel-bg-rgb', panel);
    root.style.setProperty('--panel-bg-alpha', '1');
    set('--panel-border-rgb', mix(bg, black, 0.1));
    root.style.setProperty('--panel-border-alpha', '1');
    root.style.setProperty('--panel-shadow-opacity', String(Math.max(panelShadow - 0.15, 0.1)));

    set('--panel-soft-bg-rgb', mix(bg, white, 0.5));
    root.style.setProperty('--panel-soft-bg-alpha', '1');
    set('--panel-soft-border-rgb', mix(bg, black, 0.1));
    root.style.setProperty('--panel-soft-border-alpha', '1');

    set('--elevated-bg-rgb', sidebar);
    set('--elevated-border-rgb', mix(bg, black, 0.1));
    root.style.setProperty('--elevated-border-alpha', '1');
    root.style.setProperty('--elevated-shadow-opacity', String(Math.max(panelShadow - 0.18, 0.12)));

    set('--chip-border-rgb', mix(bg, black, 0.1));
    root.style.setProperty('--chip-border-alpha', '1');
    set('--chip-bg-rgb', mix(bg, white, 0.4));
    root.style.setProperty('--chip-bg-alpha', '1');
    set('--chip-fg-rgb', mix(text, bg, 0.35));

    set('--kbd-bg-rgb', mix(bg, black, 0.04));
    root.style.setProperty('--kbd-bg-alpha', '1');

    set('--elevated-fg-rgb', text);
    set('--elevated-muted-rgb', navMuted);

    applyContentVars(theme, bg, text, primary, white, black, set, root);
  }
}
