import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { usePermissions } from '../auth/usePermissions';
import { APP_NAV } from './navConfig';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleNav = useMemo(
    () => APP_NAV.filter((item) => !item.requiredPermission || can(item.requiredPermission)),
    [can],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return visibleNav;
    return visibleNav.filter(
      (item) =>
        item.label.toLowerCase().includes(s) ||
        item.description.toLowerCase().includes(s) ||
        item.to.toLowerCase().includes(s),
    );
  }, [q, visibleNav]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal aria-label="Command palette">
      <button type="button" className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="theme-elevated-surface relative z-10 w-full max-w-xl overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-app-line px-4 py-3">
          <Search className="text-elevated-muted h-5 w-5 shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to dashboard, invoices, customers…"
            className="placeholder-elevated text-elevated-primary min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="theme-kbd-chip text-elevated-muted hidden shrink-0 rounded px-2 py-0.5 font-mono text-[10px] sm:inline">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[min(52vh,420px)] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <li className="text-elevated-muted px-4 py-8 text-center text-sm">No matches.</li>
          )}
          {filtered.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(item.to);
                    onClose();
                  }}
                  className="bg-app-nav-hover flex w-full items-start gap-3 px-4 py-3 text-left transition"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--accent-rgb))]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-elevated-primary font-semibold">{item.label}</p>
                    <p className="text-elevated-muted text-xs">{item.description}</p>
                  </div>
                  <span className="text-elevated-muted rounded border border-app-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    Route
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
