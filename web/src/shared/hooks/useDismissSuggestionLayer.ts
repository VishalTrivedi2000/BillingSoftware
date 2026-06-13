import { type RefObject, useEffect } from 'react';

/** Close floating suggestion lists on Escape or pointer-down outside the shell (grid/table wrapper). */
export function useDismissSuggestionLayer(
  open: boolean,
  shellRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    }

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const shell = shellRef.current;
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-app-sidebar]')) return;
      if (target.closest('[data-app-header]')) return;
      if (target.closest('[data-catalog-suggest]')) return;
      if (shell?.contains(target)) return;
      onDismiss();
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, onDismiss, shellRef]);
}
