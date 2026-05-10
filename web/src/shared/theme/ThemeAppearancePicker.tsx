import { Check } from 'lucide-react';
import { APP_THEME_METAS, type AppThemeId } from './appThemes';
import { useAppTheme } from './ThemeProvider';

const SWATCH: Record<AppThemeId, string> = {
  midnight: 'bg-gradient-to-br from-slate-900 via-[#070a12] to-blue-950',
  charcoal: 'bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900',
  ocean: 'bg-gradient-to-br from-cyan-950 via-slate-950 to-teal-950',
  sunset: 'bg-gradient-to-br from-orange-950 via-stone-950 to-amber-950',
  violet: 'bg-gradient-to-br from-violet-950 via-slate-950 to-indigo-950',
  paper: 'bg-gradient-to-br from-white via-slate-100 to-rose-50',
};

export function ThemeAppearancePicker() {
  const { themeId, setThemeId } = useAppTheme();

  return (
    <section className="workspace-panel space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-app-line pb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Workspace theme</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Pick a shell palette and accent. Saved in this browser only (localStorage). Use Paper for a light sidebar with a dark content area so existing screens stay readable.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {APP_THEME_METAS.map((t) => {
          const active = themeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setThemeId(t.id)}
              className={`relative flex flex-col overflow-hidden rounded-2xl border text-left transition ${
                active
                  ? 'border-[rgb(var(--accent-rgb))] ring-2 ring-[rgb(var(--accent-rgb)_/_0.35)]'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className={`relative h-20 w-full ${SWATCH[t.id]}`}>
                <span className="absolute bottom-2 left-3 inline-flex h-6 w-10 rounded-md bg-[rgb(var(--accent-rgb))] shadow-lg shadow-black/20" aria-hidden />
              </div>
              <div className="space-y-1 bg-[rgb(var(--panel-bg-rgb)_/_0.88)] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{t.label}</p>
                  {active && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--accent-rgb)_/_0.2)] px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--accent-rgb))]">
                      <Check className="h-3 w-3" aria-hidden />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs leading-snug text-slate-400">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
