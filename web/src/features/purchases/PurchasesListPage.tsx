import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PurchaseBillSummaryDto } from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { apiJsonAuth } from '../../shared/api/axiosClient';

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

type StatusFilter = 'all' | 'Draft' | 'Posted';

export function PurchasesListPage() {
  const workplaceOrgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const qs = useMemo(() => {
    const p = new URLSearchParams({ take: '100' });
    if (statusFilter !== 'all') p.set('status', statusFilter);
    return p.toString();
  }, [statusFilter]);

  const q = useQuery({
    queryKey: ['purchases-list', workplaceOrgId, statusFilter],
    queryFn: () => apiJsonAuth<PurchaseBillSummaryDto[]>(`/v1/purchases?${qs}`),
    retry: 1,
  });

  const filterBtn = (label: string, value: StatusFilter) => (
    <button
      type="button"
      key={value}
      onClick={() => setStatusFilter(value)}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
        statusFilter === value ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Billing</p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
            <Truck className="h-8 w-8 text-emerald-400" aria-hidden />
            Purchases
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Drafts sync from the composer (local + debounced server). Posted bills update inventory for physical SKUs.
          </p>
          <div className="mt-3 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
            {filterBtn('All', 'all')}
            {filterBtn('Drafts', 'Draft')}
            {filterBtn('Posted', 'Posted')}
          </div>
        </div>
        <Link
          to="/purchases/new?fresh=1"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500"
        >
          <Plus size={18} aria-hidden />
          New purchase
        </Link>
      </div>

      {q.isLoading && (
        <div className="workspace-panel flex items-center gap-3 px-6 py-10 text-slate-400">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" aria-hidden />
          Loading purchases…
        </div>
      )}

      {q.isError && (
        <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-6 py-6 text-sm text-rose-200">
          Could not load purchases. Check permissions (<span className="font-mono">purchases.read</span>) or API connectivity.
        </div>
      )}

      {q.data && q.data.length === 0 && (
        <div className="workspace-panel border border-dashed border-white/15 px-6 py-12 text-center">
          <p className="text-slate-400">No purchase bills in this view.</p>
          <Link to="/purchases/new?fresh=1" className="mt-4 inline-block text-sm font-semibold text-emerald-400 hover:underline">
            Start a draft or posted bill
          </Link>
        </div>
      )}

      {q.data && q.data.length > 0 && (
        <div className="workspace-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">Purchase</th>
                  <th className="px-6 py-3">Supplier</th>
                  <th className="px-6 py-3">Received</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((row) => {
                  const href =
                    row.status === 'Draft' ? `/purchases/drafts/${row.purchaseBillId}` : `/purchases/${row.purchaseBillId}`;
                  const label = row.purchaseNumber ?? (row.status === 'Draft' ? `Draft #${row.purchaseBillId}` : `#${row.purchaseBillId}`);
                  return (
                    <tr key={row.purchaseBillId} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                      <td className="px-6 py-3">
                        <Link to={href} className="font-mono font-semibold text-emerald-400 hover:text-emerald-300 hover:underline">
                          {label}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-slate-300">{row.supplierName}</td>
                      <td className="px-6 py-3 text-slate-500">{fmtDate(row.receivedUtc)}</td>
                      <td className="px-6 py-3">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-300">{row.status}</span>
                      </td>
                      <td className="px-6 py-3 text-right font-medium tabular-nums text-slate-100">{fmtInr(row.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
