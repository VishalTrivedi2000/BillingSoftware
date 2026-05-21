import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Loader2 } from 'lucide-react';
import { inventoryApi } from '../inventoryApi';
import { expiryStatusTone, fmtDate, fmtInr, fmtQty } from '../inventoryHelpers';
import { useAppSelector } from '../../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../auth/authSlice';

export function ExpiryFefoReportPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const ready = authed && workplace != null;

  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [daysWindow, setDaysWindow] = useState(60);

  const warehousesQ = useQuery({
    queryKey: ['inv-warehouses-list', orgId, true],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: ready,
  });

  const q = useQuery({
    queryKey: ['inv-report-expiry', orgId, warehouseId, daysWindow],
    queryFn: () => inventoryApi.reports.expiryFefo({ warehouseId, daysWindow }),
    enabled: ready,
    retry: 1,
  });

  const rows = q.data ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header>
        <p className="text-sm font-medium text-emerald-400/90">Inventory · report</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
          Expiry / FEFO
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Batches sorted First-Expiring-First-Out. Use for issue planning, returns and write-offs.
        </p>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-300">
            Warehouse
            <select
              value={warehouseId ?? ''}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : undefined)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All warehouses</option>
              {(warehousesQ.data ?? []).map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Window (days)
            <input
              type="number"
              min={1}
              max={365}
              value={daysWindow}
              onChange={(e) => setDaysWindow(Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>
      </section>

      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-left">Variant</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-right">Days</th>
                <th className="px-4 py-3 text-right">On hand</th>
                <th className="px-4 py-3 text-right">Unit cost</th>
                <th className="px-4 py-3 text-right">Value at risk</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {q.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden /> Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-emerald-300">
                    No batches within {daysWindow} days of expiry.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.batchId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Calendar className="h-4 w-4 text-amber-300" aria-hidden />
                        <span className="font-mono text-xs">{r.batchNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-slate-200">{r.productName}</div>
                      <div className="text-slate-500">{r.sku ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.warehouseName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(r.expiryDate)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">
                      {r.daysToExpiry ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-100">{fmtQty(r.onHandQty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {r.unitCost != null ? fmtInr(r.unitCost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-200">
                      {r.totalValueAtRisk != null ? fmtInr(r.totalValueAtRisk) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${expiryStatusTone(r.expiryStatus)}`}>
                        {r.expiryStatus}
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
