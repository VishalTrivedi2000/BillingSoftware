import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, X } from 'lucide-react';
import { OpenInvoicePickerModal } from './OpenInvoicePickerModal';
import { useInvoiceComposer } from './InvoiceComposerContext';
import { isComposerTypingTarget } from '../../shared/composer/composerShortcuts';

export function InvoiceComposerTabStrip() {
  const navigate = useNavigate();
  const { tabs, routeTabId, addTab, closeTab } = useInvoiceComposer();
  const [openPicker, setOpenPicker] = useState(false);

  useEffect(() => {
    function go(delta: number) {
      if (!routeTabId || tabs.length === 0) return;
      const i = tabs.findIndex((t) => t.id === routeTabId);
      if (i < 0) return;
      const next = (i + delta + tabs.length) % tabs.length;
      const tid = tabs[next]?.id;
      if (tid) navigate(`/invoices/new/${tid}`);
    }

    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;

      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') {
        if (isComposerTypingTarget(e.target)) return;
        e.preventDefault();
        addTab();
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (isComposerTypingTarget(e.target)) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          go(-1);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          go(1);
          return;
        }
        if (/^[1-9]$/.test(e.key)) {
          const idx = Number(e.key) - 1;
          const tab = tabs[idx];
          if (tab) {
            e.preventDefault();
            navigate(`/invoices/new/${tab.id}`);
          }
        }
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tabs, routeTabId, navigate, addTab]);

  return (
    <div className="mb-2 flex flex-col gap-2 border-b border-white/10 pb-3">
      <div className="flex min-h-[42px] items-stretch gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const active = routeTabId === t.id;
          return (
            <div
              key={t.id}
              className={`group flex max-w-[220px] shrink-0 items-stretch rounded-t-lg border border-b-0 ${
                active ? 'border-white/15 bg-white/[0.07]' : 'border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <NavLink
                to={`/invoices/new/${t.id}`}
                className={`flex min-w-0 flex-1 items-center px-3 py-2 text-sm font-medium ${
                  active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t.title}
              >
                <span className="truncate">{t.title}</span>
              </NavLink>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  closeTab(t.id);
                }}
                className={`shrink-0 rounded-md p-2 text-slate-500 hover:bg-rose-500/15 hover:text-rose-200 ${
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                aria-label={`Close ${t.title}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
        <div className="flex shrink-0 items-center gap-1 self-center">
          <button
            type="button"
            onClick={() => setOpenPicker(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-white/20 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-teal-500/40 hover:text-teal-200"
            title="Copy customer and lines from a saved invoice"
          >
            <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
            Open invoice…
          </button>
          <button
            type="button"
            onClick={() => addTab()}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-white/20 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-teal-500/40 hover:text-teal-200"
            title="Open another invoice draft in parallel"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            New tab
          </button>
        </div>
      </div>
      <OpenInvoicePickerModal open={openPicker} onClose={() => setOpenPicker(false)} />
      <p className="text-[11px] leading-relaxed text-slate-500">
        Drafts are stored in this browser (like Chrome tabs).{' '}
        <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Esc</kbd>
        {' closes item search · '}
        <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Alt</kbd>
        {' + '}
        <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">←</kbd>
        /
        <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">→</kbd>
        {' prev/next tab · '}
        <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Alt</kbd>
        {' + 1–9 jump · '}
        <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Alt</kbd>
        {' + '}
        <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">Shift</kbd>
        {' + '}
        <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[10px] text-slate-400">N</kbd>
        {' new tab.'}
      </p>
    </div>
  );
}
