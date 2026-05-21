import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Loader2, Search } from 'lucide-react';
import { inventoryApi } from '../inventoryApi';
import { fmtInr, fmtQty, stockStatusTone } from '../inventoryHelpers';
import { useAppSelector } from '../../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../auth/authSlice';

export function StockSummaryReportPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const ready = authed && workplace != null;

  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [search, setSearch] = useState('');

  const warehousesQ = useQuery({
    queryKey: ['inv-warehouses-list', orgId, true],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: ready,
  });

  const reportQ = useQuery({
    queryKey: ['inv-report-stock-summary', orgId, warehouseId, search],
    queryFn: () =>
      inventoryApi.reports.stockSummary({ warehouseId, search: search.trim() || undefined }),
    enabled: ready,
    retry: 1,
  });

  const rows = useMemo(() => reportQ.data?.rows ?? [], [reportQ.data]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header>
        <p className="text-sm font-medium text-emerald-400/90">Inventory · report</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">Stock summary</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Per-variant snapshot of on hand, reserved, available, damaged, and value-at-cost across
          warehouses.
        </p>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-3">
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
          <label className="block text-xs font-semibold text-slate-300 lg:col-span-2">
            Search
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SKU, product name…"
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </div>
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs lg:grid-cols-5">
          <Stat label="Total SKUs" value={String(reportQ.data?.totalSkus ?? 0)} />
          <Stat label="In stock" value={String(reportQ.data?.inStockCount ?? 0)} tone="emerald" />
          <Stat label="Low stock" value={String(reportQ.data?.lowStockCount ?? 0)} tone="amber" />
          <Stat label="Out of stock" value={String(reportQ.data?.outOfStockCount ?? 0)} tone="rose" />
          <Stat label="Value at cost" value={fmtInr(reportQ.data?.totalOnHandValue ?? 0)} tone="amber" />
        </div>
      </section>

      {reportQ.isError && (
        <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          Could not load report. Ensure you have <span className="font-mono">reports.inventory</span>.
        </div>
      )}

      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Variant</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-right">On hand</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Damaged</th>
                <th className="px-4 py-3 text-right">Avg cost</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reportQ.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden /> Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    No stock data.
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
                        <Boxes className="h-4 w-4 text-blue-300" aria-hidden />
                        <div>
                          <p className="font-semibold">{r.productName}</p>
                          <p className="text-xs text-slate-500">{r.sku ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.warehouseName ?? 'All'}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-100">{fmtQty(r.onHandQty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-violet-300">{fmtQty(r.reservedQty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-300">{fmtQty(r.availableQty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-300">{fmtQty(r.damagedQty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {r.averageCost != null ? fmtInr(r.averageCost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-200">
                      {fmtInr(r.inventoryValueAtCost)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${stockStatusTone(r.stockStatus)}`}>
                        {r.stockStatus ?? '—'}
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'amber' | 'rose' }) {
  const accent =
    tone === 'emerald'
      ? 'text-emerald-300'
      : tone === 'amber'
        ? 'text-amber-300'
        : tone === 'rose'
          ? 'text-rose-300'
          : 'text-white';
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-base font-bold ${accent}`}>{value}</p>
    </div>
  );
}
