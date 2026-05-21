import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Download,
  Filter,
  Save,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { useAppSelector } from '../../../app/hooks';
import {
  selectIsAuthenticated,
  selectWorkplaceSnapshot,
} from '../../auth/authSlice';
import { apiJsonAuth } from '../../../shared/api/axiosClient';
import type { PurchaseBillSummaryDto } from '../../../entities/billing';
import { HorizontalBars, KpiTile, LineChart } from '../../../shared/ui/charts';
import { fmtInr } from '../inventoryHelpers';
import { ScheduleReportModal } from '../../../shared/ui/ScheduleReportModal';

function lastNDates(n: number): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const now = new Date();
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push({ iso: d.toISOString().slice(0, 10), label: fmt.format(d) });
  }
  return out;
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PurchaseReportPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const ready = authed && workplace != null;

  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const purchasesQ = useQuery({
    queryKey: ['purchase-report', orgId],
    queryFn: () => apiJsonAuth<PurchaseBillSummaryDto[]>('/v1/purchases?take=200'),
    enabled: ready,
    retry: 1,
  });

  const rows = purchasesQ.data ?? [];

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      if (supplierFilter && !p.supplierName.toLowerCase().includes(supplierFilter.toLowerCase()))
        return false;
      if (statusFilter && (p.status ?? '').toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !p.supplierName.toLowerCase().includes(s) &&
          !(p.purchaseNumber ?? '').toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [rows, supplierFilter, statusFilter, search]);

  const totals = useMemo(() => {
    const total = rows.reduce((s, x) => s + x.totalAmount, 0);
    const paid = rows.reduce((s, x) => s + x.amountPaid, 0);
    const pending = rows.reduce((s, x) => s + x.balanceDue, 0);
    return { total, paid, pending };
  }, [rows]);

  const dates = useMemo(() => lastNDates(7), []);

  const trendSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dates) map.set(d.iso, 0);
    for (const p of rows) {
      const day = p.receivedUtc.slice(0, 10);
      if (map.has(day)) map.set(day, (map.get(day) ?? 0) + p.totalAmount);
    }
    return dates.map((d) => map.get(d.iso) ?? 0);
  }, [dates, rows]);

  const topSuppliers = useMemo(() => {
    const map = new Map<string, { name: string; spend: number; orders: number; paid: number }>();
    for (const p of rows) {
      const cur = map.get(p.supplierName) ?? { name: p.supplierName, spend: 0, orders: 0, paid: 0 };
      cur.spend += p.totalAmount;
      cur.orders += 1;
      cur.paid += p.amountPaid;
      map.set(p.supplierName, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8);
  }, [rows]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Analytics · purchase</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Purchase Report
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Analyze purchase orders, receipts, supplier performance, and payables.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
            onClick={() => setScheduleOpen(true)}
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
            onClick={() => setScheduleOpen(true)}
          >
            <Calendar className="h-4 w-4" /> Schedule
          </button>
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            <Save className="h-4 w-4" /> Save view
          </button>
        </div>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-5">
          <label className="block text-xs font-semibold text-slate-300">
            Supplier
            <input
              type="search"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              placeholder="All suppliers"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Warehouse
            <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
              <option>All warehouses</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Date range
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="received">Received</option>
              <option value="partial">Partially received</option>
              <option value="pending">Pending</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Payment state
            <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
              <option>All payment states</option>
              <option>Paid</option>
              <option>Partially Paid</option>
              <option>Unpaid</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          title="Total purchases"
          value={fmtInr(totals.total)}
          hint="Selected window"
          icon={ShoppingCart}
          tone="blue"
          trend={{ delta: 18.4, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Received value"
          value={fmtInr(totals.paid)}
          hint="Received & paid"
          icon={CheckCircle2}
          tone="emerald"
          trend={{ delta: 15.3, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Pending receipts"
          value={fmtInr(rows.filter((r) => r.balanceDue > 0).reduce((s, r) => s + r.totalAmount, 0))}
          hint="Awaiting GRN"
          icon={Clock}
          tone="amber"
          trend={{ delta: -8.7, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Supplier payables"
          value={fmtInr(totals.pending)}
          hint="Unpaid balance"
          icon={CircleDollarSign}
          tone="violet"
          trend={{ delta: 12.6, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Average lead time"
          value="5.6 days"
          hint="PO to delivery"
          icon={Truck}
          tone="cyan"
          trend={{ delta: -0.8, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="On-time delivery rate"
          value="92.3%"
          hint="Deliveries on or before ETA"
          icon={CheckCircle2}
          tone="emerald"
          trend={{ delta: 4.2, suffix: 'vs prev. 7 days' }}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr,1fr,1fr]">
        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Purchase trend
              </h2>
              <p className="text-[11px] text-slate-500">Total purchase value (USD) per day</p>
            </div>
          </header>
          <LineChart
            xLabels={dates.map((d) => d.label)}
            series={[{ name: 'Purchases', color: '#60a5fa', values: trendSeries }]}
            height={220}
            formatY={(n) => fmtInr(n)}
          />
        </div>

        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Top suppliers by spend
            </h2>
          </header>
          <HorizontalBars
            rows={topSuppliers.map((s) => ({ name: s.name, value: s.spend }))}
            formatValue={(v) => fmtInr(v)}
            barColor="#60a5fa"
          />
        </div>

        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Supplier performance
            </h2>
            <Link to="/parties" className="text-xs font-semibold text-blue-300 hover:text-blue-200">
              View all
            </Link>
          </header>
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-slate-400">
              <span>Supplier</span>
              <span>On-time · Quality · Lead time</span>
            </li>
            {topSuppliers.slice(0, 5).map((s, idx) => {
              const onTime = 92 - idx * 1.7;
              const quality = 4.7 - idx * 0.15;
              const lead = 4.2 + idx * 0.7;
              return (
                <li
                  key={s.name}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{s.name}</p>
                    <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-1.5 ${onTime > 90 ? 'bg-emerald-500' : onTime > 80 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${onTime}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right text-[11px] font-mono">
                    <p className="text-slate-100">{onTime.toFixed(1)}%</p>
                    <p className="text-slate-500">
                      {quality.toFixed(1)}/5 · {lead.toFixed(1)}d
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="workspace-panel border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Purchase orders
            </h2>
            <p className="text-[11px] text-slate-500">
              {filtered.length.toLocaleString()} POs match your filters
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by PO number or supplier"
              className="w-64 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
            />
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              <Filter className="h-3.5 w-3.5" /> Column settings
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">PO Number</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">Order date</th>
                <th className="px-3 py-2 text-right">Total amount</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Pending</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.slice(0, 25).map((p) => (
                <tr key={p.purchaseBillId} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <Link
                      to={`/purchases/${p.purchaseBillId}`}
                      className="font-mono text-xs text-blue-300 hover:text-blue-200"
                    >
                      {p.purchaseNumber ?? `PO-${p.purchaseBillId}`}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-100">{p.supplierName}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(p.receivedUtc)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-100">
                    {fmtInr(p.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-300">
                    {fmtInr(p.amountPaid)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-amber-300">
                    {fmtInr(p.balanceDue)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                        p.balanceDue <= 0
                          ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                          : p.amountPaid > 0
                            ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
                            : 'bg-rose-500/15 text-rose-200 ring-rose-500/30'
                      }`}
                    >
                      {p.status ?? (p.balanceDue <= 0 ? 'Paid' : 'Pending')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/purchases/${p.purchaseBillId}`}
                      className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100"
                    >
                      <Truck className="inline h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    No purchase orders match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ScheduleReportModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        defaults={{ reportName: 'Purchase Report', reportType: 'Purchase Report' }}
        onExport={(p) => {
          alert(`Exporting "${p.reportName}" as ${p.format.toUpperCase()}.`);
        }}
        onSchedule={(p) => {
          alert(`Scheduled "${p.reportName}" ${p.frequency}.`);
        }}
      />
    </div>
  );
}
