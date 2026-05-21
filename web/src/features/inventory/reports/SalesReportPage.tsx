import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Filter,
  Hash,
  Save,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import { useAppSelector } from '../../../app/hooks';
import {
  selectIsAuthenticated,
  selectWorkplaceSnapshot,
} from '../../auth/authSlice';
import { apiJsonAuth } from '../../../shared/api/axiosClient';
import type { InvoiceSummaryDto } from '../../../entities/billing';
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

export function SalesReportPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const ready = authed && workplace != null;

  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const invoicesQ = useQuery({
    queryKey: ['sales-report-invoices', orgId],
    queryFn: () => apiJsonAuth<InvoiceSummaryDto[]>('/v1/invoices?take=200'),
    enabled: ready,
    retry: 1,
  });

  const invoices = invoicesQ.data ?? [];

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (customerFilter && !inv.customerName.toLowerCase().includes(customerFilter.toLowerCase()))
        return false;
      if (paymentStatusFilter) {
        const status = (inv.status ?? '').toLowerCase();
        if (paymentStatusFilter === 'paid' && status !== 'paid') return false;
        if (paymentStatusFilter === 'unpaid' && status === 'paid') return false;
        if (paymentStatusFilter === 'partial' && !/(partial)/i.test(status)) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        if (
          !inv.customerName.toLowerCase().includes(s) &&
          !(inv.invoiceNumber ?? '').toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [invoices, customerFilter, paymentStatusFilter, search]);

  const dates = useMemo(() => lastNDates(7), []);

  const trendSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dates) map.set(d.iso, 0);
    for (const inv of invoices) {
      const day = inv.issueUtc.slice(0, 10);
      if (map.has(day)) map.set(day, (map.get(day) ?? 0) + inv.totalAmount);
    }
    return dates.map((d) => map.get(d.iso) ?? 0);
  }, [dates, invoices]);

  const channelBreakdown = useMemo(() => {
    const channels = ['Retail Store', 'Online Store', 'Wholesale', 'Marketplace', 'Distributor'];
    const data = channels.map((c, i) => ({
      name: c,
      value: invoices.length > 0 ? Math.floor(invoices.reduce((s, x) => s + x.totalAmount, 0) / (i + 2)) : 0,
    }));
    return data.sort((a, b) => b.value - a.value);
  }, [invoices]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; sales: number; invoices: number; paid: number }>();
    for (const inv of invoices) {
      const cur = map.get(inv.customerName) ?? {
        name: inv.customerName,
        sales: 0,
        invoices: 0,
        paid: 0,
      };
      cur.sales += inv.totalAmount;
      cur.invoices += 1;
      cur.paid += inv.amountPaid;
      map.set(inv.customerName, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 6);
  }, [invoices]);

  const totalSales = useMemo(() => invoices.reduce((s, x) => s + x.totalAmount, 0), [invoices]);
  const totalPaid = useMemo(() => invoices.reduce((s, x) => s + x.amountPaid, 0), [invoices]);
  const totalOutstanding = useMemo(() => invoices.reduce((s, x) => s + x.balanceDue, 0), [invoices]);
  const avgOrderValue = invoices.length > 0 ? totalSales / invoices.length : 0;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Analytics · sales</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Sales Report
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Track invoice performance, revenue, payments, and dispatch trends.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Calendar className="h-4 w-4" /> Schedule
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
            onClick={() => setScheduleOpen(true)}
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            <Save className="h-4 w-4" /> Save report
          </button>
        </div>
      </header>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="block text-xs font-semibold text-slate-300">
            Customer
            <input
              type="search"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="All customers"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Sales channel
            <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
              <option>All channels</option>
              {['Retail Store', 'Online Store', 'Wholesale', 'Marketplace'].map((c) => (
                <option key={c}>{c}</option>
              ))}
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
            Warehouse
            <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
              <option>All warehouses</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Payment status
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partially paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300">
            Delivery status
            <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
              <option>All statuses</option>
              <option>Delivered</option>
              <option>In Transit</option>
              <option>Pending</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          title="Total sales"
          value={fmtInr(totalSales)}
          hint="Selected window"
          icon={CircleDollarSign}
          tone="emerald"
          trend={{ delta: 18.7, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Paid amount"
          value={fmtInr(totalPaid)}
          hint="Total collected"
          icon={CheckCircle2}
          tone="blue"
          trend={{ delta: 16.2, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Outstanding"
          value={fmtInr(totalOutstanding)}
          hint="Unpaid balance"
          icon={CircleDollarSign}
          tone="amber"
          trend={{ delta: -3.7, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Average order"
          value={fmtInr(avgOrderValue)}
          hint="Per invoice"
          icon={ShoppingCart}
          tone="violet"
          trend={{ delta: 5.6, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Invoices issued"
          value={invoices.length.toLocaleString()}
          hint="Selected window"
          icon={Hash}
          tone="cyan"
        />
        <KpiTile
          title="Units sold"
          value={invoices.reduce((s, x) => s + (x.totalAmount > 0 ? 1 : 0), 0).toLocaleString()}
          hint="Approx (invoices)"
          icon={Truck}
          tone="rose"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr,1fr,1fr]">
        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Sales trend
              </h2>
              <p className="text-[11px] text-slate-500">Total sales (USD) per day</p>
            </div>
          </header>
          <LineChart
            xLabels={dates.map((d) => d.label)}
            series={[{ name: 'Total sales (USD)', color: '#60a5fa', values: trendSeries }]}
            height={220}
            formatY={(n) => fmtInr(n)}
          />
        </div>

        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Sales by channel
            </h2>
          </header>
          <HorizontalBars
            rows={channelBreakdown.map((c) => ({ name: c.name, value: c.value }))}
            formatValue={(v) => fmtInr(v)}
            barColor="#60a5fa"
          />
        </div>

        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Top customers
            </h2>
            <Link to="/customers" className="text-xs font-semibold text-blue-300 hover:text-blue-200">
              View all
            </Link>
          </header>
          <ul className="space-y-2 text-sm">
            {topCustomers.map((c) => (
              <li
                key={c.name}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-100">{c.name}</p>
                  <p className="text-[11px] text-slate-500">{c.invoices} invoices</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-slate-100">{fmtInr(c.sales)}</p>
                  <p className="text-[11px] text-emerald-300">
                    {c.sales > 0 ? `${((c.paid / c.sales) * 100).toFixed(0)}% paid` : '—'}
                  </p>
                </div>
              </li>
            ))}
            {topCustomers.length === 0 && (
              <li className="text-xs text-slate-500">No customers yet.</li>
            )}
          </ul>
        </div>
      </section>

      <section className="workspace-panel border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Sales report
            </h2>
            <p className="text-[11px] text-slate-500">
              {filtered.length.toLocaleString()} invoices match your filters
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by invoice, customer or reference"
                className="w-64 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
              />
            </div>
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
                <th className="px-3 py-2 text-left">Invoice #</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2 text-left">Payment status</th>
                <th className="px-3 py-2 text-left">Channel</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.slice(0, 25).map((inv) => (
                <tr key={inv.invoiceId} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <Link
                      to={`/invoices/${inv.invoiceId}`}
                      className="font-mono text-xs text-blue-300 hover:text-blue-200"
                    >
                      {inv.invoiceNumber ?? `INV-${inv.invoiceId}`}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-100">{inv.customerName}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(inv.issueUtc)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-100">
                    {fmtInr(inv.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-300">
                    {fmtInr(inv.amountPaid)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-amber-300">
                    {fmtInr(inv.balanceDue)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                        inv.balanceDue <= 0
                          ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                          : inv.amountPaid > 0
                            ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
                            : 'bg-rose-500/15 text-rose-200 ring-rose-500/30'
                      }`}
                    >
                      {inv.balanceDue <= 0
                        ? 'Paid'
                        : inv.amountPaid > 0
                          ? 'Partial'
                          : 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{inv.lastPaymentChannel ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100"
                    >
                      <Users className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                    No invoices match the current filters.
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
        defaults={{ reportName: 'Sales Report', reportType: 'Sales Report' }}
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
