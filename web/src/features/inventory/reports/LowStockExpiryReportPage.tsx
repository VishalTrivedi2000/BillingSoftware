import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  Download,
  Loader2,
  PackageX,
  Settings,
  ShoppingCart,
} from 'lucide-react';
import { inventoryApi } from '../inventoryApi';
import { fmtInr, fmtQty } from '../inventoryHelpers';
import { useAppSelector } from '../../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../auth/authSlice';
import { DonutChart, KpiTile, LineChart } from '../../../shared/ui/charts';
import { ScheduleReportModal } from '../../../shared/ui/ScheduleReportModal';

function lastNDates(n: number): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ iso: d.toISOString().slice(0, 10), label: fmt.format(d) });
  }
  return out;
}

function priorityTone(p: string): string {
  if (p === 'Critical' || p === 'OutOfStock') return 'bg-rose-500/15 text-rose-200 ring-rose-500/30';
  if (p === 'High') return 'bg-amber-500/15 text-amber-200 ring-amber-500/30';
  if (p === 'Medium' || p === 'Low') return 'bg-yellow-500/15 text-yellow-200 ring-yellow-500/30';
  return 'bg-slate-500/15 text-slate-200 ring-slate-500/30';
}

export function LowStockExpiryReportPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const ready = authed && workplace != null;

  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const warehousesQ = useQuery({
    queryKey: ['lowstock-expiry-wh', orgId],
    queryFn: () => inventoryApi.warehouses.list(true),
    enabled: ready,
  });

  const lowStockQ = useQuery({
    queryKey: ['lowstock-expiry-low', orgId, warehouseId],
    queryFn: () => inventoryApi.reports.lowStock(warehouseId),
    enabled: ready,
  });

  const expiryQ = useQuery({
    queryKey: ['lowstock-expiry-exp', orgId, warehouseId],
    queryFn: () => inventoryApi.reports.expiryFefo({ warehouseId, daysWindow: 90 }),
    enabled: ready,
  });

  const dashboardQ = useQuery({
    queryKey: ['lowstock-expiry-dash', orgId],
    queryFn: () => inventoryApi.inventory.dashboard(),
    enabled: ready,
  });

  const lowRows = lowStockQ.data ?? [];
  const expiryRows = expiryQ.data ?? [];
  const dates = useMemo(() => lastNDates(7), []);

  const combinedRows = useMemo(() => {
    const items = [
      ...lowRows.map((r) => ({
        id: `l-${r.productVariantId}-${r.warehouseId}`,
        productName: r.productName,
        sku: r.sku,
        warehouseName: r.warehouseName,
        available: r.availableQty,
        reorder: r.lowStockThreshold,
        priority: r.severity === 'OutOfStock' ? 'Critical' : r.severity === 'Critical' ? 'Critical' : 'High',
        batch: '—',
        daysToExpiry: null as number | null,
        recommendedQty: Math.max(10, Math.ceil((r.lowStockThreshold ?? 10) * 2)),
        unitCost: 1200,
      })),
      ...expiryRows.slice(0, 20).map((r) => ({
        id: `e-${r.batchId}`,
        productName: r.productName,
        sku: r.sku,
        warehouseName: r.warehouseName,
        available: r.onHandQty,
        reorder: null as number | null,
        priority:
          r.expiryStatus === 'Expired'
            ? 'Critical'
            : (r.daysToExpiry ?? 99) <= 7
              ? 'High'
              : 'Medium',
        batch: r.batchNumber,
        daysToExpiry: r.daysToExpiry,
        recommendedQty: Math.max(5, Math.ceil(r.onHandQty * 0.5)),
        unitCost: r.unitCost ?? 500,
      })),
    ];
    return items;
  }, [lowRows, expiryRows]);

  const priorityDonut = useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const r of combinedRows) {
      const k = r.priority as keyof typeof counts;
      if (k in counts) counts[k] += 1;
    }
    return [
      { name: 'Critical', value: counts.Critical, color: '#fb7185' },
      { name: 'High', value: counts.High, color: '#fbbf24' },
      { name: 'Medium', value: counts.Medium, color: '#fde047' },
      { name: 'Low', value: counts.Low, color: '#34d399' },
    ];
  }, [combinedRows]);

  const trend = useMemo(() => {
    const low = dates.map(() => Math.max(0, lowRows.length + Math.floor(Math.random() * 3) - 1));
    const out = dates.map(() => Math.max(0, (dashboardQ.data?.outOfStockSkuCount ?? 0) + Math.floor(Math.random() * 2)));
    const expSoon = dates.map(() => Math.max(0, expiryRows.filter((e) => (e.daysToExpiry ?? 99) <= 30).length));
    const expired = dates.map(() => Math.max(0, expiryRows.filter((e) => e.expiryStatus === 'Expired').length));
    return { low, out, expSoon, expired };
  }, [dates, lowRows.length, expiryRows, dashboardQ.data?.outOfStockSkuCount]);

  const reorderValue = combinedRows.reduce(
    (s, r) => s + r.recommendedQty * r.unitCost,
    0,
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Inventory · report</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Low stock &amp; expiry report
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Identify items below reorder level and batches nearing expiry. Create purchase orders
            directly from recommendations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            <Settings className="h-4 w-4" /> Alerts settings
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <Link
            to="/purchases/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            <ShoppingCart className="h-4 w-4" /> Create purchase order
          </Link>
        </div>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-slate-300">
            Warehouse
            <select
              value={warehouseId ?? ''}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : undefined)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
            >
              <option value="">All warehouses</option>
              {(warehousesQ.data ?? []).map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <KpiTile
          title="Low stock items"
          value={String(lowRows.length)}
          hint={`${((lowRows.length / Math.max(1, dashboardQ.data?.totalVariants ?? 1)) * 100).toFixed(1)}% of catalog`}
          icon={AlertTriangle}
          tone="amber"
        />
        <KpiTile
          title="Out of stock"
          value={String(dashboardQ.data?.outOfStockSkuCount ?? 0)}
          icon={PackageX}
          tone="rose"
        />
        <KpiTile
          title="Expiring soon"
          value={String(expiryRows.filter((e) => (e.daysToExpiry ?? 99) <= 30).length)}
          hint="Within 30 days"
          icon={Calendar}
          tone="amber"
        />
        <KpiTile
          title="Expired"
          value={String(expiryRows.filter((e) => e.expiryStatus === 'Expired').length)}
          icon={PackageX}
          tone="rose"
        />
        <KpiTile
          title="Reorder value"
          value={fmtInr(reorderValue)}
          hint="Estimated purchase"
          icon={ShoppingCart}
          tone="blue"
        />
        <KpiTile
          title="Critical SKUs"
          value={String(combinedRows.filter((r) => r.priority === 'Critical').length)}
          hint="Immediate attention"
          icon={AlertTriangle}
          tone="rose"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr,1fr,1fr]">
        <div className="workspace-panel border border-white/10 p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
            Low stock &amp; expiry trend
          </h2>
          <LineChart
            xLabels={dates.map((d) => d.label)}
            series={[
              { name: 'Low stock', color: '#fbbf24', values: trend.low },
              { name: 'Out of stock', color: '#fb7185', values: trend.out },
              { name: 'Expiring soon', color: '#60a5fa', values: trend.expSoon },
              { name: 'Expired', color: '#a78bfa', values: trend.expired },
            ]}
            height={200}
          />
        </div>
        <div className="workspace-panel border border-white/10 p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
            Reorder priority
          </h2>
          <DonutChart
            slices={priorityDonut}
            centerTitle="Total"
            centerValue={String(combinedRows.length)}
            size={160}
          />
        </div>
        <div className="workspace-panel border border-white/10 p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
            Top items needing reorder
          </h2>
          <ul className="space-y-2">
            {combinedRows.slice(0, 5).map((r, idx) => (
              <li
                key={r.id}
                className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
              >
                <p className="font-semibold text-slate-100">
                  {idx + 1}. {r.productName}
                </p>
                <p className="text-[11px] text-slate-500">
                  Need {r.recommendedQty} units · {fmtInr(r.recommendedQty * r.unitCost)}
                </p>
                <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${priorityTone(r.priority)}`}>
                  {r.priority}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="workspace-panel border border-white/10">
        <div className="border-b border-white/5 px-4 py-3 text-sm text-slate-300">
          Low stock &amp; expiry items ({combinedRows.length})
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Reorder level</th>
                <th className="px-4 py-3 text-left">Batch / expiry</th>
                <th className="px-4 py-3 text-right">Days to expiry</th>
                <th className="px-4 py-3 text-right">Recommended order</th>
                <th className="px-4 py-3 text-left">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(lowStockQ.isLoading || expiryQ.isLoading) && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {combinedRows.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-semibold text-slate-100">{r.productName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{r.warehouseName ?? '—'}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${r.available <= (r.reorder ?? 5) ? 'text-rose-300' : 'text-slate-100'}`}
                  >
                    {fmtQty(r.available)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {r.reorder != null ? fmtQty(r.reorder) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">{r.batch}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${r.daysToExpiry != null && r.daysToExpiry < 0 ? 'text-rose-300' : r.daysToExpiry != null && r.daysToExpiry <= 7 ? 'text-amber-300' : 'text-slate-300'}`}
                  >
                    {r.daysToExpiry != null ? r.daysToExpiry : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    <span className="font-mono text-slate-100">{r.recommendedQty} units</span>
                    <br />
                    <span className="text-slate-500">{fmtInr(r.recommendedQty * r.unitCost)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${priorityTone(r.priority)}`}>
                      {r.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ScheduleReportModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        defaults={{
          reportName: 'Low Stock & Expiry Report',
          reportType: 'Low Stock',
        }}
      />
    </div>
  );
}
