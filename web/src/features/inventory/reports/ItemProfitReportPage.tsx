import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, Loader2 } from 'lucide-react';
import { inventoryApi } from '../inventoryApi';
import { fmtInr, fmtQty } from '../inventoryHelpers';
import { useAppSelector } from '../../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../auth/authSlice';

function toIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function ItemProfitReportPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const ready = authed && workplace != null;

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const q = useQuery({
    queryKey: ['inv-report-item-profit', from, to],
    queryFn: () =>
      inventoryApi.reports.itemProfit({ fromUtc: toIso(from), toUtc: toIso(to) }),
    enabled: ready,
    retry: 1,
  });

  const rows = q.data ?? [];
  const summary = rows.reduce(
    (s, r) => ({
      qty: s.qty + r.quantitySold,
      rev: s.rev + r.totalRevenue,
      cost: s.cost + r.totalCost,
      profit: s.profit + r.grossProfit,
    }),
    { qty: 0, rev: 0, cost: 0, profit: 0 },
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header>
        <p className="text-sm font-medium text-emerald-400/90">Inventory · report</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
          Item profitability
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Per-variant revenue, cost and gross margin in the selected window. Costs come from the
          inventory ledger (weighted-average).
        </p>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-300">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs lg:grid-cols-4">
          <Stat label="Quantity sold" value={fmtQty(summary.qty)} />
          <Stat label="Revenue" value={fmtInr(summary.rev)} tone="emerald" />
          <Stat label="Cost" value={fmtInr(summary.cost)} tone="rose" />
          <Stat label="Gross profit" value={fmtInr(summary.profit)} tone="amber" />
        </div>
      </section>

      <section className="workspace-panel border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Variant</th>
                <th className="px-4 py-3 text-right">Qty sold</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Gross profit</th>
                <th className="px-4 py-3 text-right">Margin %</th>
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
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No sales in this window.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.productVariantId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-100">
                        <CircleDollarSign className="h-4 w-4 text-amber-300" aria-hidden />
                        <div>
                          <p className="font-semibold">{r.productName}</p>
                          <p className="text-xs text-slate-500">{r.sku ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">{fmtQty(r.quantitySold)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-300">{fmtInr(r.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-300">{fmtInr(r.totalCost)}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${r.grossProfit >= 0 ? 'text-amber-200' : 'text-rose-300'}`}
                    >
                      {fmtInr(r.grossProfit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">
                      {r.grossMarginPercent.toFixed(2)}%
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'emerald' | 'amber' | 'rose';
}) {
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
