import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import { fmtDate, fmtInr, fmtQty } from './inventoryHelpers';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';

const PAGE_SIZE = 50;

export function InventoryBalancesPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const queryReady = authed && workplace != null;

  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(0);

  const warehousesQ = useQuery({
    queryKey: ['inv-warehouses-list', orgId, true],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: queryReady,
    retry: 1,
  });

  const balancesQ = useQuery({
    queryKey: ['inv-balances', orgId, warehouseId, search, lowStockOnly, page],
    queryFn: () =>
      inventoryApi.inventory.balances({
        warehouseId,
        search: search.trim() || undefined,
        lowStockOnly,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    enabled: queryReady,
    retry: 1,
  });

  const rows = balancesQ.data?.items ?? [];
  const totalCount = balancesQ.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const summary = useMemo(() => {
    const onHand = rows.reduce((s, r) => s + r.onHandQty, 0);
    const available = rows.reduce((s, r) => s + r.availableQty, 0);
    const reserved = rows.reduce((s, r) => s + r.reservedQty, 0);
    const value = rows.reduce((s, r) => s + (r.onHandQty * (r.averageCost ?? 0)), 0);
    return { onHand, available, reserved, value };
  }, [rows]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Inventory · stock posture</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Stock balances
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Computed from the inventory ledger per variant/warehouse/batch. Available = On hand −
            Reserved − Damaged − (allocations).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/inventory/ledger"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Open ledger
          </Link>
          <Link
            to="/inventory/adjustments/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            New adjustment
          </Link>
        </div>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <label className="block text-xs font-semibold text-slate-300">
            Warehouse
            <select
              value={warehouseId ?? ''}
              onChange={(e) => {
                setPage(0);
                setWarehouseId(e.target.value ? Number(e.target.value) : undefined);
              }}
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
                onChange={(e) => {
                  setPage(0);
                  setSearch(e.target.value);
                }}
                placeholder="Search SKU, product name…"
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </div>
          </label>
          <label className="flex items-end gap-2 text-xs font-semibold text-slate-300">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setPage(0);
                setLowStockOnly(e.target.checked);
              }}
              className="h-4 w-4 rounded border-white/30 bg-transparent"
            />
            Low stock only
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs lg:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">On hand (page)</p>
            <p className="mt-1 font-mono text-base font-bold text-white">{fmtQty(summary.onHand)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Available</p>
            <p className="mt-1 font-mono text-base font-bold text-emerald-300">{fmtQty(summary.available)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Reserved</p>
            <p className="mt-1 font-mono text-base font-bold text-violet-300">{fmtQty(summary.reserved)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Value at cost</p>
            <p className="mt-1 font-mono text-base font-bold text-amber-200">{fmtInr(summary.value)}</p>
          </div>
        </div>
      </section>

      {balancesQ.isError && (
        <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          Could not load balances. Ensure you have <span className="font-mono">inventory.view</span>.
        </div>
      )}

      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Variant / SKU</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-left">Batch / Expiry</th>
                <th className="px-4 py-3 text-right">On hand</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Damaged</th>
                <th className="px-4 py-3 text-right">Avg cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {balancesQ.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                    Loading balances…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No balances for the chosen filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={`${r.productVariantId}_${r.warehouseId}_${r.batchId ?? 'nobatch'}`}
                    className="hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Boxes className="h-4 w-4 text-blue-300" aria-hidden />
                        <div>
                          <p className="font-semibold">{r.variantDisplay}</p>
                          <p className="text-xs text-slate-500">{r.sku ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.warehouseName}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {r.batchNumber ? (
                        <>
                          <div className="text-slate-200">{r.batchNumber}</div>
                          {r.expiryDate && <div>{fmtDate(r.expiryDate)}</div>}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-100">{fmtQty(r.onHandQty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-violet-300">{fmtQty(r.reservedQty)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono ${r.availableQty <= 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {fmtQty(r.availableQty)}
                        {r.availableQty <= 0 && (
                          <AlertTriangle className="ml-1 inline h-3 w-3" aria-hidden />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-300">{fmtQty(r.damagedQty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {r.averageCost != null ? fmtInr(r.averageCost) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-3 text-xs text-slate-400">
          <span>
            {rows.length === 0 ? '0' : `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + rows.length}`} of{' '}
            {totalCount.toLocaleString()}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-semibold text-slate-200 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Prev
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-semibold text-slate-200 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
