import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Lightweight portal-based modal used across inventory, reporting, and sales flows.
 *
 * - Body scroll is locked while open.
 * - Focus is captured on the dialog container so escape works.
 * - Overlay click and the ✕ button both call `onClose`.
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[min(96vw,1200px)]',
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  hideCloseButton = false,
  initialFocusOnContainer = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  hideCloseButton?: boolean;
  initialFocusOnContainer?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (initialFocusOnContainer) containerRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, initialFocusOnContainer]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Dismiss dialog"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative max-h-[92vh] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/40 outline-none ${SIZE_CLASS[size]}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-slate-900/95 px-5 py-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-base font-bold text-white">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </header>
        <div className="max-h-[calc(92vh-120px)] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-slate-950/40 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ============================================================================
   Confirm dialog (delete, danger, info)
   ============================================================================ */
export type ConfirmTone = 'danger' | 'warning' | 'info';

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  tone = 'danger',
  loading = false,
  children,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  loading?: boolean;
  children?: ReactNode;
}) {
  const confirmTone =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white'
      : tone === 'warning'
        ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
        : 'bg-blue-600 hover:bg-blue-500 text-white';
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm" hideCloseButton>
      <div className="space-y-3 text-center">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            tone === 'danger'
              ? 'bg-rose-500/15 text-rose-300'
              : tone === 'warning'
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-blue-500/15 text-blue-300'
          }`}
        >
          {tone === 'danger' ? '!' : tone === 'warning' ? '⚠' : 'i'}
        </div>
        {message && <p className="text-sm text-slate-300">{message}</p>}
        {children}
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${confirmTone}`}
          >
            {loading ? 'Working…' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================================
   Alert toast / pill that auto-dismisses
   ============================================================================ */
export type AlertTone = 'info' | 'success' | 'warning' | 'danger';
export function AlertBanner({
  tone = 'info',
  title,
  message,
  onDismiss,
}: {
  tone?: AlertTone;
  title: string;
  message?: string;
  onDismiss?: () => void;
}) {
  const palette = {
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-100',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  }[tone];
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${palette}`}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {message && <p className="mt-0.5 text-xs opacity-80">{message}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 opacity-70 hover:bg-white/10 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
