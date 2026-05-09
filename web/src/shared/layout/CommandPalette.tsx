import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { APP_NAV } from './navConfig';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return APP_NAV;
    return APP_NAV.filter(
      (item) =>
        item.label.toLowerCase().includes(s) ||
        item.description.toLowerCase().includes(s) ||
        item.to.toLowerCase().includes(s),
    );
  }, [q]);

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
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-white/12 bg-[#0f141f] shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to dashboard, invoices, customers…"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
          />
          <kbd className="hidden shrink-0 rounded border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-500 sm:inline">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[min(52vh,420px)] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">No matches.</li>
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
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-blue-400/90" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-100">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                  <span className="rounded border border-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
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
