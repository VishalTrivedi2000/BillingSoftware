import type { CatalogPickSuggestion } from './productCatalogPick';

type Theme = 'light' | 'dark';

const themeClass: Record<
  Theme,
  {
    list: string;
    hint: string;
    empty: string;
    item: string;
    title: string;
    detail: string;
    badge: string;
    create: string;
  }
> = {
  light: {
    list: 'absolute left-2 top-full z-[80] max-h-[min(70vh,28rem)] min-h-[220px] min-w-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl',
    hint: 'pointer-events-none px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500',
    empty: 'pointer-events-none px-3 py-2 text-xs text-slate-500',
    item: 'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-slate-50',
    title: 'text-xs font-semibold text-slate-900',
    detail: 'text-[10px] text-slate-500',
    badge: 'rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-600',
    create: 'flex w-full px-3 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-slate-50',
  },
  dark: {
    list: 'absolute left-0 top-[calc(100%+8px)] z-[320] max-h-[min(70vh,28rem)] min-h-[220px] min-w-[300px] max-w-[min(100vw-2rem,520px)] overflow-y-auto rounded-xl border border-white/20 bg-[#151b28] py-1 shadow-2xl ring-1 ring-black/50',
    hint: 'pointer-events-none px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-600',
    empty: 'pointer-events-none px-3 py-2 text-xs text-slate-500',
    item: 'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-white/10',
    title: 'text-sm text-slate-100',
    detail: 'text-[10px] text-slate-500',
    badge: 'rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-400',
    create: 'flex w-full px-3 py-2 text-left text-xs font-semibold text-emerald-400 hover:bg-white/10',
  },
};

type Props = {
  theme: Theme;
  suggestions: CatalogPickSuggestion[];
  loading?: boolean;
  filterActive: boolean;
  canManageProducts?: boolean;
  onPick: (pick: CatalogPickSuggestion) => void;
  onCreateNew?: () => void;
  className?: string;
};

export function ProductCatalogSuggestList({
  theme,
  suggestions,
  loading,
  filterActive,
  canManageProducts,
  onPick,
  onCreateNew,
  className,
}: Props) {
  const t = themeClass[theme];

  return (
    <ul className={className ?? t.list}>
      {loading && <li className={t.empty}>Searching variants…</li>}
      {!loading && !filterActive && suggestions.length > 0 && (
        <li className={t.hint}>Products & variants · type to narrow</li>
      )}
      {filterActive && !loading && suggestions.length === 0 && (
        <li className={t.empty}>No matches — try another name, SKU, or barcode.</li>
      )}
      {suggestions.map((s) => (
        <li key={s.key}>
          <button
            type="button"
            className={t.item}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(s)}
          >
            <span className="flex items-center gap-2">
              <span className={t.title}>{s.title}</span>
              {s.variant && !s.isMainProduct && (
                <span className={t.badge}>Variant</span>
              )}
              {s.isMainProduct && s.variant && (
                <span className={t.badge}>Default</span>
              )}
            </span>
            <span className={t.detail}>{s.detail}</span>
          </button>
        </li>
      ))}
      {canManageProducts && onCreateNew && (
        <li className={theme === 'dark' ? 'border-t border-white/10' : 'border-t border-slate-200'}>
          <button type="button" className={t.create} onMouseDown={(e) => e.preventDefault()} onClick={onCreateNew}>
            + Create new catalog item…
          </button>
        </li>
      )}
    </ul>
  );
}
