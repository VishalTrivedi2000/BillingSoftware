import { Check } from 'lucide-react';
import { CATALOG_THEME_METAS } from './catalogTheme';
import { useAppTheme } from './ThemeProvider';

export function ThemeAppearancePicker() {
  const { themeId, setThemeId } = useAppTheme();

  return (
    <section className="workspace-panel space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-app-line pb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Workspace themes</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            All presets from your billing catalog ({CATALOG_THEME_METAS.length} themes). Choice is saved in
            this browser only. Light themes use a light sidebar with dark work panels so invoices and
            inventory screens stay readable.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {CATALOG_THEME_METAS.map((meta) => {
          const active = themeId === meta.id;
          const t = meta.theme;
          return (
            <button
              key={meta.id}
              type="button"
              onClick={() => setThemeId(meta.id)}
              className={`relative flex flex-col overflow-hidden rounded-2xl border text-left transition ${
                active
                  ? 'border-[rgb(var(--accent-rgb))] ring-2 ring-[rgb(var(--accent-rgb)_/_0.35)]'
                  : 'border-white/10 hover:border-white/20'
              }`}
              style={{ borderRadius: `min(${t.BorderRadius}px, 24px)` }}
            >
              <div
                className="relative h-24 w-full"
                style={{
                  background: `linear-gradient(145deg, ${t.BackgroundColor} 0%, ${t.SecondaryColor}44 55%, ${t.PrimaryColor}33 100%)`,
                }}
              >
                <span
                  className="absolute bottom-3 left-3 inline-flex h-7 w-12 rounded-lg shadow-lg"
                  style={{ backgroundColor: t.PrimaryColor }}
                  aria-hidden
                />
                <span
                  className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: `${t.PrimaryColor}22`,
                    color: t.TextColor,
                  }}
                >
                  {t.IsDark ? 'Dark' : 'Light'}
                </span>
              </div>
              <div className="space-y-1 bg-[rgb(var(--panel-bg-rgb)_/_0.88)] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{meta.label}</p>
                  {active && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--accent-rgb)_/_0.2)] px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--accent-rgb))]">
                      <Check className="h-3 w-3" aria-hidden />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs leading-snug text-slate-400">{meta.description}</p>
                <p className="font-mono text-[10px] text-slate-500">
                  {t.PrimaryColor} · radius {t.BorderRadius}px
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
