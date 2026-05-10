import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Loader2, X } from 'lucide-react';
import type { PurchaseBillSummaryDto } from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import { usePurchaseComposer } from './PurchaseComposerContext';

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function OpenPurchaseDraftPickerModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const workplaceOrgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;
  const { routeTabId } = usePurchaseComposer();
  const [filter, setFilter] = useState('');

  const qs = useMemo(() => {
    const p = new URLSearchParams({ status: 'Draft', take: '80' });
    return p.toString();
  }, []);

  const q = useQuery({
    queryKey: ['purchase-draft-picker', workplaceOrgId],
    enabled: open && workplaceOrgId > 0,
    queryFn: () => apiJsonAuth<PurchaseBillSummaryDto[]>(`/v1/purchases?${qs}`),
    retry: 1,
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const rows = useMemo(() => {
    const list = q.data ?? [];
    const f = filter.trim().toLowerCase();
    if (!f) return list;
    return list.filter((row) => {
      const label = (row.purchaseNumber ?? `Draft #${row.purchaseBillId}`).toLowerCase();
      return (
        label.includes(f) ||
        row.supplierName.toLowerCase().includes(f) ||
        String(row.purchaseBillId).includes(f)
      );
    });
  }, [q.data, filter]);

  function pick(row: PurchaseBillSummaryDto) {
    if (!routeTabId) return;
    navigate(`/purchases/new/${routeTabId}?loadDraft=${row.purchaseBillId}`);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal
      aria-labelledby="purchase-draft-picker-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(560px,85vh)] w-full max-w-lg flex-col rounded-2xl border border-white/15 bg-[#111827] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h3 id="purchase-draft-picker-title" className="flex items-center gap-2 text-lg font-bold text-white">
              <FolderOpen className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
              Open saved draft
            </h3>
            <p className="mt-1 text-xs text-slate-500">Loads the server draft into this tab.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="shrink-0 border-b border-white/10 px-5 py-3">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by supplier, number, or id…"
            className="w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {q.isLoading && (
            <div className="flex items-center gap-2 px-3 py-8 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-400/80" aria-hidden />
              Loading drafts…
            </div>
          )}
          {q.isError && (
            <p role="alert" className="px-3 py-6 text-sm text-rose-300">
              Could not load drafts. Check permissions or try again.
            </p>
          )}
          {q.isSuccess && rows.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-slate-500">No drafts match this filter.</p>
          )}
          <ul className="space-y-1 pb-2">
            {rows.map((row) => {
              const label = row.purchaseNumber ?? `Draft #${row.purchaseBillId}`;
              return (
                <li key={row.purchaseBillId}>
                  <button
                    type="button"
                    onClick={() => pick(row)}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono font-semibold text-emerald-300">{label}</span>
                      <span className="shrink-0 tabular-nums text-slate-300">{fmtInr(row.totalAmount)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span className="truncate">{row.supplierName}</span>
                      <span aria-hidden>·</span>
                      <span>{fmtDate(row.receivedUtc)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-600 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
