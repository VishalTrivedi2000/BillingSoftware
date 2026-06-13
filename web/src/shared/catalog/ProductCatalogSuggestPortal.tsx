import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ProductCatalogSuggestList } from './ProductCatalogSuggestList';
import type { CatalogPickSuggestion } from './productCatalogPick';

type Theme = 'light' | 'dark';

type Pos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function computePosition(anchor: HTMLElement): Pos {
  const rect = anchor.getBoundingClientRect();
  const gap = 8;
  const minWidth = Math.max(rect.width, 320);
  const preferredMax = Math.min(window.innerHeight * 0.65, 480);
  const minHeight = 220;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
  const spaceAbove = rect.top - gap - 12;

  let top = rect.bottom + gap;
  let maxHeight = Math.max(minHeight, Math.min(preferredMax, spaceBelow));

  if (maxHeight < minHeight && spaceAbove > spaceBelow) {
    maxHeight = Math.max(minHeight, Math.min(preferredMax, spaceAbove));
    top = Math.max(12, rect.top - gap - maxHeight);
  } else if (maxHeight < minHeight) {
    maxHeight = Math.max(160, spaceBelow);
  }

  const left = Math.min(
    Math.max(12, rect.left),
    window.innerWidth - minWidth - 12,
  );

  return { top, left, width: minWidth, maxHeight };
}

type Props = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  theme: Theme;
  suggestions: CatalogPickSuggestion[];
  loading?: boolean;
  filterActive: boolean;
  canManageProducts?: boolean;
  onPick: (pick: CatalogPickSuggestion) => void;
  onCreateNew?: () => void;
  children: ReactNode;
};

export function ProductCatalogSuggestPortal({
  open,
  anchorRef,
  theme,
  suggestions,
  loading,
  filterActive,
  canManageProducts,
  onPick,
  onCreateNew,
  children,
}: Props) {
  const [pos, setPos] = useState<Pos | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;

    const update = () => setPos(computePosition(anchor));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, suggestions.length, loading]);

  const portal =
    open && pos
      ? createPortal(
          <div
            data-catalog-suggest
            className="pointer-events-auto"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              zIndex: 10000,
            }}
          >
            <ProductCatalogSuggestList
              theme={theme}
              suggestions={suggestions}
              loading={loading}
              filterActive={filterActive}
              canManageProducts={canManageProducts}
              onPick={onPick}
              onCreateNew={onCreateNew}
              className={
                theme === 'dark'
                  ? 'max-h-full min-h-[220px] w-full overflow-y-auto rounded-xl border border-white/20 bg-[#151b28] py-1 shadow-2xl ring-1 ring-black/50'
                  : 'max-h-full min-h-[220px] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl'
              }
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {children}
      {portal}
    </>
  );
}
