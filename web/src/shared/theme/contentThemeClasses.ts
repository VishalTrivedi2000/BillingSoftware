/** Theme-aware class names for main workspace pages (forms, tables, cards). */

export const appPageCanvas =
  'app-page-canvas -mx-4 -mt-4 min-h-full px-4 pb-16 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8';

export const appSurface = 'app-surface rounded-2xl border p-5 shadow-sm';

export const appSurfaceSm = 'app-surface rounded-xl border p-4 shadow-sm';

export const appFieldInput =
  'app-field w-full rounded-lg border px-3 py-2 text-sm shadow-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60';

export const appFieldLabel = 'app-field-label text-xs font-semibold';

export const appTextMuted = 'app-text-muted text-sm';

export const appTextSubtle = 'app-text-subtle text-xs';

export const appHeading = 'app-heading text-2xl font-bold tracking-tight';

export const appSectionTitle = 'app-section-title text-sm font-bold';

export const appBtnPrimary =
  'app-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60';

export const appBtnSecondary =
  'app-btn-secondary inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition';

export const appLinkAccent = 'app-link text-xs font-semibold';

export const appTableShell = 'app-table overflow-x-auto rounded-xl border';

export const appTableHead =
  'app-table-head border-b text-left text-[10px] font-semibold uppercase tracking-wide';

export const appAlertSuccess = 'app-alert-success rounded-lg border px-4 py-2 text-sm';

export const appTabBar = 'app-tab-bar mb-6 flex gap-1 overflow-x-auto border-b pb-px';

export const appTabBtn = (active: boolean) =>
  `app-tab shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
    active ? 'app-tab-active' : 'app-tab-inactive'
  }`;
