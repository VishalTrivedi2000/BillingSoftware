import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Plus, Truck } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtDateTime, fmtInr, fmtQty } from './inventoryHelpers';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';

export function StockTransfersPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const queryReady = authed && workplace != null;

  const listQ = useQuery({
    queryKey: ['inv-transfers', orgId],
    queryFn: () => inventoryApi.transfers.list({ take: 50 }),
    enabled: queryReady,
    retry: 1,
  });

  const rows = listQ.data ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Inventory · transfers</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Stock transfers
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Move stock between warehouses. Each transfer posts paired TRANSFER_OUT / TRANSFER_IN
            ledger entries — quantities stay reconcilable.
          </p>
        </div>
        <Link
          to="/inventory/transfers/new"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New transfer
        </Link>
      </header>

      {listQ.isError && (
        <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          Could not load transfers. Ensure you have <span className="font-mono">inventory.view</span>.
        </div>
      )}

      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Number</th>
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-left">From → To</th>
                <th className="px-4 py-3 text-right">Lines</th>
                <th className="px-4 py-3 text-right">Total qty</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {listQ.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                    Loading transfers…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No stock transfers yet.
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.stockTransferId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Truck className="h-4 w-4 text-blue-300" aria-hidden />
                        <span className="font-mono text-xs">{t.transferNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmtDateTime(t.transferDateUtc)}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-slate-200">{t.fromWarehouseName}</div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <ArrowRight className="h-3 w-3" aria-hidden /> {t.toWarehouseName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">{t.lineCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-300">{fmtQty(t.totalQuantity)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {t.totalValue != null ? fmtInr(t.totalValue) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
