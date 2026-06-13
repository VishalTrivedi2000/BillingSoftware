import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { CATALOG_THEME_METAS } from './catalogTheme';
import { useAppTheme } from './ThemeProvider';

type Props = {
  /** Compact icon-only trigger for the header bar. */
  variant?: 'header' | 'panel';
};

export function ThemeToggle({ variant = 'header' }: Props) {
  const { themeId, setThemeId } = useAppTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerClass =
    variant === 'header'
      ? 'theme-header-chip rounded-xl p-2'
      : 'rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/5';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Change workspace theme"
        title="Themes"
      >
        <Palette className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Workspace themes"
          className="theme-elevated-surface absolute right-0 z-[200] mt-2 max-h-[min(70vh,520px)] w-[min(92vw,320px)] overflow-hidden rounded-2xl"
        >
          <div className="border-b border-app-line px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-elevated-muted">Themes</p>
            <p className="mt-0.5 text-[11px] text-elevated-muted">
              {CATALOG_THEME_METAS.length} presets · saved in this browser
            </p>
          </div>
          <ul className="max-h-[min(60vh,440px)] overflow-y-auto py-1">
            {CATALOG_THEME_METAS.map((meta) => {
              const active = themeId === meta.id;
              return (
                <li key={meta.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/5 ${
                      active ? 'bg-[rgb(var(--accent-rgb)_/_0.12)]' : ''
                    }`}
                    onClick={() => {
                      setThemeId(meta.id);
                      setOpen(false);
                    }}
                  >
                    <span
                      className="h-9 w-9 shrink-0 rounded-xl border border-white/10 shadow-inner"
                      style={{
                        background: `linear-gradient(135deg, ${meta.theme.PrimaryColor}, ${meta.theme.SecondaryColor})`,
                      }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-elevated-primary">{meta.label}</span>
                        {active && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--accent-rgb))]" aria-hidden />
                        )}
                      </span>
                      <span className="block text-[10px] text-elevated-muted">
                        {meta.theme.IsDark ? 'Dark' : 'Light'} · radius {meta.theme.BorderRadius}px
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
