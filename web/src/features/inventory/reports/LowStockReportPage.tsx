import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, PackageX } from 'lucide-react';
import { inventoryApi } from '../inventoryApi';
import { fmtQty } from '../inventoryHelpers';
import { useAppSelector } from '../../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../auth/authSlice';

function severityTone(s: string): string {
  switch (s) {
    case 'OutOfStock':
      return 'bg-rose-500/10 text-rose-300 ring-rose-500/30';
    case 'Critical':
      return 'bg-rose-500/10 text-rose-300 ring-rose-500/30';
    case 'Low':
      return 'bg-amber-500/10 text-amber-300 ring-amber-500/30';
    default:
      return 'bg-slate-500/10 text-slate-300 ring-slate-500/30';
  }
}

export function LowStockReportPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const ready = authed && workplace != null;

  const [warehouseId, setWarehouseId] = useState<number | undefined>();

  const warehousesQ = useQuery({
    queryKey: ['inv-warehouses-list', orgId, true],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: ready,
  });

  const q = useQuery({
    queryKey: ['inv-report-low-stock', orgId, warehouseId],
    queryFn: () => inventoryApi.reports.lowStock(warehouseId),
    enabled: ready,
    retry: 1,
  });

  const rows = q.data ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header>
        <p className="text-sm font-medium text-emerald-400/90">Inventory · report</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
          Low stock alerts
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Variants whose available quantity has dipped below their reorder threshold (or zero).
        </p>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <label className="block text-xs font-semibold text-slate-300">
          Warehouse
          <select
            value={warehouseId ?? ''}
            onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : undefined)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none lg:w-72"
          >
            <option value="">All warehouses</option>
            {(warehousesQ.data ?? []).map((w) => (
              <option key={w.warehouseId} value={w.warehouseId}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Variant</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Threshold</th>
                <th className="px-4 py-3 text-left">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {q.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden /> Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-emerald-300">
                    All variants are above reorder threshold.
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
                        {r.severity === 'OutOfStock' || r.severity === 'Critical' ? (
                          <PackageX className="h-4 w-4 text-rose-300" aria-hidden />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden />
                        )}
                        <div>
                          <p className="font-semibold">{r.productName}</p>
                          <p className="text-xs text-slate-500">{r.sku ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.categoryName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.warehouseName ?? 'All'}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-300">{fmtQty(r.availableQty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {r.lowStockThreshold != null ? fmtQty(r.lowStockThreshold) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${severityTone(r.severity)}`}>
                        {r.severity}
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
