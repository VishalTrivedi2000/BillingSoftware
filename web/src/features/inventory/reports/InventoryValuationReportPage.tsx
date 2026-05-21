import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Warehouse } from 'lucide-react';
import { inventoryApi } from '../inventoryApi';
import { fmtInr, fmtQty } from '../inventoryHelpers';
import { useAppSelector } from '../../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../auth/authSlice';

export function InventoryValuationReportPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const ready = authed && workplace != null;

  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [costingMethod, setCostingMethod] = useState('AverageCost');

  const warehousesQ = useQuery({
    queryKey: ['inv-warehouses-list', orgId, true],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: ready,
  });

  const q = useQuery({
    queryKey: ['inv-report-valuation', orgId, warehouseId, costingMethod],
    queryFn: () => inventoryApi.reports.valuation({ warehouseId, costingMethod }),
    enabled: ready,
    retry: 1,
  });

  const rows = q.data ?? [];
  const totals = rows.reduce(
    (s, r) => ({
      qty: s.qty + r.onHandQty,
      value: s.value + (r.totalValue ?? 0),
    }),
    { qty: 0, value: 0 },
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header>
        <p className="text-sm font-medium text-emerald-400/90">Inventory · report</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
          Stock valuation
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Value of stock on hand at the selected costing method. Average cost is computed from
          inventory ledger transactions.
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
            Costing method
            <select
              value={costingMethod}
              onChange={(e) => setCostingMethod(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="AverageCost">Average cost</option>
              <option value="FIFO">FIFO (latest layers)</option>
              <option value="LIFO">LIFO</option>
              <option value="LastCost">Last purchase cost</option>
            </select>
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total on hand</p>
            <p className="mt-1 font-mono text-base font-bold text-white">{fmtQty(totals.qty)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total value</p>
            <p className="mt-1 font-mono text-base font-bold text-amber-200">{fmtInr(totals.value)}</p>
          </div>
        </div>
      </section>

      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Variant</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-right">On hand</th>
                <th className="px-4 py-3 text-right">Avg cost</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Age (days)</th>
                <th className="px-4 py-3 text-left">Age bucket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {q.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden /> Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No stock to value.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={`${r.productVariantId}_${r.warehouseId ?? 'all'}`}
                    className="hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Warehouse className="h-4 w-4 text-blue-300" aria-hidden />
                        <div>
                          <p className="font-semibold">{r.productName}</p>
                          <p className="text-xs text-slate-500">{r.sku ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.categoryName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.warehouseName ?? 'All'}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-100">{fmtQty(r.onHandQty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {r.averageCost != null ? fmtInr(r.averageCost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-200">
                      {r.totalValue != null ? fmtInr(r.totalValue) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{r.ageDays ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.ageBucket ?? '—'}</td>
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
