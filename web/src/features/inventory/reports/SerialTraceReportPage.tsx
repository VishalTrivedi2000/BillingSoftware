import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Hash, Loader2, Search } from 'lucide-react';
import { inventoryApi } from '../inventoryApi';
import { fmtDate, fmtInr } from '../inventoryHelpers';
import { useAppSelector } from '../../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../auth/authSlice';

export function SerialTraceReportPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const ready = authed && workplace != null;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const q = useQuery({
    queryKey: ['inv-report-serial-trace', search, status],
    queryFn: () =>
      inventoryApi.reports.serialTrace({
        search: search.trim() || undefined,
        status: status || undefined,
      }),
    enabled: ready,
    retry: 1,
  });

  const rows = q.data ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header>
        <p className="text-sm font-medium text-emerald-400/90">Inventory · report</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
          Serial trace & profitability
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Per-serial lifecycle: purchase cost ➝ sale price ➝ gross profit. Useful for high-value
          electronics, lots, and warranty audits.
        </p>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="block text-xs font-semibold text-slate-300 lg:col-span-2">
            Search
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Serial / IMEI / product / SKU"
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </div>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All</option>
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Sold">Sold</option>
              <option value="Returned">Returned</option>
              <option value="Damaged">Damaged</option>
            </select>
          </label>
        </div>
      </section>

      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Serial</th>
                <th className="px-4 py-3 text-left">Variant</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Purchase</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-left">Sold</th>
                <th className="px-4 py-3 text-right">Sale price</th>
                <th className="px-4 py-3 text-right">Gross profit</th>
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
                    No serials match the search.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.productSerialId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Hash className="h-4 w-4 text-violet-300" aria-hidden />
                        <span className="font-mono text-xs">{r.serialNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-slate-200">{r.productName}</div>
                      <div className="text-slate-500">{r.sku ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.status}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {r.purchaseInvoiceNumber ? (
                        <>
                          <div className="font-mono">{r.purchaseInvoiceNumber}</div>
                          <div className="text-slate-500">{fmtDate(r.purchaseDateUtc)}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {r.purchaseCostPerUnit != null ? fmtInr(r.purchaseCostPerUnit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {r.soldInvoiceNumber ? (
                        <>
                          <div className="font-mono">{r.soldInvoiceNumber}</div>
                          <div className="text-slate-500">{fmtDate(r.soldDateUtc)}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-300">
                      {r.sellingPrice != null ? fmtInr(r.sellingPrice) : '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${(r.grossProfit ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                    >
                      {r.grossProfit != null ? fmtInr(r.grossProfit) : '—'}
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
