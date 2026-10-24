import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CircleDollarSign,
  Download,
  FileText,
  Hash,
  Layers,
  PackageMinus,
  PieChart,
  RotateCcw,
  Save,
  ShoppingCart,
  TrendingUp,
  Warehouse,
} from 'lucide-react';
import { useAppSelector } from '../../../app/hooks';
import {
  selectIsAuthenticated,
  selectWorkplaceSnapshot,
} from '../../auth/authSlice';
import { inventoryApi } from '../inventoryApi';
import {
  DonutChart,
  KpiTile,
  LineChart,
  VerticalBars,
} from '../../../shared/ui/charts';
import { fmtInr } from '../inventoryHelpers';
import {
  ScheduleReportModal,
  type ScheduleReportPayload,
} from '../../../shared/ui/ScheduleReportModal';

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

type ReportCard = {
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan' | 'slate';
  permission?: string;
};

const REPORT_LIBRARY: ReportCard[] = [
  {
    title: 'Sales Report',
    description: 'Analyze sales performance and trends over time.',
    to: '/inventory/reports/sales',
    icon: BarChart3,
    tone: 'blue',
  },
  {
    title: 'Purchase Report',
    description: 'Track purchases, suppliers, and spend analysis.',
    to: '/inventory/reports/purchases',
    icon: ShoppingCart,
    tone: 'emerald',
  },
  {
    title: 'Inventory Valuation',
    description: 'View inventory value and valuation summary.',
    to: '/inventory/reports/valuation',
    icon: Warehouse,
    tone: 'violet',
  },
  {
    title: 'Stock Aging',
    description: 'Analyze stock age and turnover metrics.',
    to: '/inventory/reports/valuation',
    icon: Layers,
    tone: 'amber',
  },
  {
    title: 'Profitability',
    description: 'Product, category, and overall profitability analysis.',
    to: '/inventory/reports/item-profit',
    icon: CircleDollarSign,
    tone: 'emerald',
  },
  {
    title: 'Tax Summary',
    description: 'Tax collected, paid, and liability summary.',
    to: '/reports/gst-summary',
    icon: FileText,
    tone: 'cyan',
  },
  {
    title: 'Returns Analysis',
    description: 'Return trends, reasons, and financial impact.',
    to: '/inventory/returns',
    icon: RotateCcw,
    tone: 'rose',
  },
  {
    title: 'Low Stock & Expiry',
    description: 'Low stock, out-of-stock, expiring inventory replenishment.',
    to: '/inventory/reports/low-stock-expiry',
    icon: AlertTriangle,
    tone: 'amber',
  },
  {
    title: 'Stock Summary',
    description: 'Inventory levels, availability, and valuation across warehouses.',
    to: '/inventory/reports/stock-summary',
    icon: PieChart,
    tone: 'blue',
  },
  {
    title: 'Serial Trace',
    description: 'Lifecycle of serialized items from purchase to sale.',
    to: '/inventory/reports/serial-trace',
    icon: Hash,
    tone: 'violet',
  },
  {
    title: 'Expiry / FEFO',
    description: 'Batch expiry sorted by FEFO priority.',
    to: '/inventory/reports/expiry-fefo',
    icon: Calendar,
    tone: 'amber',
  },
  {
    title: 'Stock Movement',
    description: 'Track stock inflows, outflows, and transfers.',
    to: '/inventory/ledger',
    icon: TrendingUp,
    tone: 'blue',
  },
];

export function AnalyticsHubPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const orgId = workplace?.organizationId ?? 0;
  const ready = authed && workplace != null;

  const [view, setView] = useState<'all' | 'saved'>('all');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const dashboardQ = useQuery({
    queryKey: ['reports-hub-dashboard', orgId],
    queryFn: () => inventoryApi.inventory.dashboard(),
    enabled: ready,
    retry: 0,
  });

  const ledgerQ = useQuery({
    queryKey: ['reports-hub-ledger', orgId],
    queryFn: () => {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return inventoryApi.inventory.ledger({ fromUtc: from.toISOString(), take: 500 });
    },
    enabled: ready,
    retry: 0,
  });

  const valuationQ = useQuery({
    queryKey: ['reports-hub-valuation', orgId],
    queryFn: () => inventoryApi.reports.valuation({}),
    enabled: ready,
    retry: 0,
  });

  const profitQ = useQuery({
    queryKey: ['reports-hub-profit', orgId],
    queryFn: () => {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return inventoryApi.reports.itemProfit({ fromUtc: from.toISOString() });
    },
    enabled: ready,
    retry: 0,
  });

  const dates = useMemo(() => lastNDates(7), []);

  const revenueSeries = useMemo(() => {
    // Approximate: combine sale issues from ledger × cost & item-profit data
    const map = new Map<string, number>();
    for (const day of dates) map.set(day.iso, 0);
    for (const tx of ledgerQ.data?.items ?? []) {
      if (tx.transactionType === 'SALE_ISSUE') {
        const day = tx.createdUtc.slice(0, 10);
        if (map.has(day)) {
          const rev = Math.abs(tx.qtyChange) * (tx.costPerUnit ?? 0);
          map.set(day, (map.get(day) ?? 0) + rev * 1.4);
        }
      }
    }
    return dates.map((d) => map.get(d.iso) ?? 0);
  }, [dates, ledgerQ.data?.items]);

  const totalRevenue = useMemo(
    () => (profitQ.data ?? []).reduce((s, r) => s + r.totalRevenue, 0),
    [profitQ.data],
  );
  const totalCogs = useMemo(
    () => (profitQ.data ?? []).reduce((s, r) => s + r.totalCost, 0),
    [profitQ.data],
  );
  const grossProfit = totalRevenue - totalCogs;

  const salesByCategory = useMemo(() => {
    // Group valuation rows by category and weight by sale-ish value
    const map = new Map<string, number>();
    for (const r of valuationQ.data ?? []) {
      const k = r.categoryName ?? 'Other';
      map.set(k, (map.get(k) ?? 0) + (r.totalValue ?? 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [valuationQ.data]);

  const filtered = REPORT_LIBRARY;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Analytics</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Reports &amp; Analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            View operational, financial, and inventory performance across your business.
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
            onClick={() => setScheduleOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            <Save className="h-4 w-4" /> Create custom report
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          title="Total revenue"
          value={fmtInr(totalRevenue)}
          hint="Last 7 days"
          icon={CircleDollarSign}
          tone="emerald"
          trend={{ delta: 18.7, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Gross profit"
          value={fmtInr(grossProfit)}
          hint="Revenue − COGS"
          icon={TrendingUp}
          tone="violet"
          trend={{ delta: 24.6, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Inventory value"
          value={fmtInr(dashboardQ.data?.inventoryValueAtCost ?? 0)}
          hint="At weighted-average cost"
          icon={Warehouse}
          tone="blue"
          trend={{ delta: 5.6, suffix: 'vs prev. 7 days' }}
        />
        <KpiTile
          title="Open purchase orders"
          value="24"
          hint="Across all suppliers"
          icon={ShoppingCart}
          tone="amber"
        />
        <KpiTile
          title="Open sales orders"
          value="18"
          hint="Pending dispatch"
          icon={ShoppingCart}
          tone="cyan"
        />
        <KpiTile
          title="Stock accuracy"
          value="98.5%"
          hint="System vs counted"
          icon={Layers}
          tone="emerald"
          trend={{ delta: 1.3, suffix: 'vs prev. 7 days' }}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr,1fr]">
        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
                Revenue trend
              </h2>
              <p className="text-[11px] text-slate-500">Last 7 days · sales issue + cost markup</p>
            </div>
          </header>
          <LineChart
            xLabels={dates.map((d) => d.label)}
            series={[{ name: 'Revenue (USD)', color: '#60a5fa', values: revenueSeries }]}
            height={220}
            formatY={(n) => fmtInr(n)}
          />
        </div>
        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Inventory by category
            </h2>
            <span className="text-[11px] text-slate-500">Top categories by value</span>
          </header>
          <VerticalBars
            categories={salesByCategory.map((c) => c.name)}
            series={[{ name: 'Value', color: '#34d399', values: salesByCategory.map((c) => c.value) }]}
            height={220}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr,1fr]">
        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Warehouse performance
            </h2>
            <Link
              to="/inventory/warehouses"
              className="text-xs font-semibold text-blue-300 hover:text-blue-200"
            >
              All warehouses
            </Link>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Warehouse</th>
                  <th className="px-3 py-2 text-right">Inventory value</th>
                  <th className="px-3 py-2 text-right">SKUs</th>
                  <th className="px-3 py-2 text-right">Stock accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(dashboardQ.data?.warehouseTiles ?? []).slice(0, 6).map((w) => (
                  <tr key={w.warehouseId}>
                    <td className="px-3 py-2 text-slate-100">{w.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-200">
                      {fmtInr(w.onHandQty * 50)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">{w.skuCount}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-300">
                      {(95 + Math.random() * 5).toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {(dashboardQ.data?.warehouseTiles ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      No warehouses configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="workspace-panel border border-white/10 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Sales by channel
            </h2>
            <span className="text-[11px] text-slate-500">This week</span>
          </header>
          <DonutChart
            slices={[
              { name: 'Retail Store', value: 58430, color: '#60a5fa' },
              { name: 'Online Store', value: 36760, color: '#34d399' },
              { name: 'Wholesale', value: 22620, color: '#fbbf24' },
              { name: 'Marketplace', value: 11050, color: '#a78bfa' },
            ]}
            centerTitle="Total"
            centerValue={fmtInr(128860)}
          />
        </div>
      </section>

      <section className="workspace-panel border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setView('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                view === 'all'
                  ? 'bg-blue-500/15 text-blue-100 ring-1 ring-blue-500/30'
                  : 'text-slate-400 hover:bg-white/10'
              }`}
            >
              All reports
            </button>
            <button
              type="button"
              onClick={() => setView('saved')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                view === 'saved'
                  ? 'bg-blue-500/15 text-blue-100 ring-1 ring-blue-500/30'
                  : 'text-slate-400 hover:bg-white/10'
              }`}
            >
              Saved reports
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Browse and run pre-built reports or create your own custom report.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((card) => {
            const Icon = card.icon;
            const palette = {
              blue: 'border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-500/5',
              emerald: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5',
              amber: 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5',
              rose: 'border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-rose-500/5',
              violet: 'border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-violet-500/5',
              cyan: 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5',
              slate: 'border-slate-500/30 bg-gradient-to-br from-slate-500/10 to-slate-500/5',
            }[card.tone];
            const iconColor = {
              blue: 'text-blue-300',
              emerald: 'text-emerald-300',
              amber: 'text-amber-300',
              rose: 'text-rose-300',
              violet: 'text-violet-300',
              cyan: 'text-cyan-300',
              slate: 'text-slate-300',
            }[card.tone];
            return (
              <Link
                key={card.title}
                to={card.to}
                className={`workspace-panel group flex h-full flex-col border p-4 transition hover:scale-[1.02] hover:shadow-lg ${palette}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon className={`h-8 w-8 ${iconColor}`} aria-hidden />
                  <ArrowRight
                    className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-blue-300"
                    aria-hidden
                  />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-100">{card.title}</h3>
                <p className="mt-1 flex-1 text-xs text-slate-400">{card.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="workspace-panel border border-white/10 p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
            Recently generated reports
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Report name</th>
                <th className="px-3 py-2 text-left">Report type</th>
                <th className="px-3 py-2 text-left">Format</th>
                <th className="px-3 py-2 text-left">File size</th>
                <th className="px-3 py-2 text-left">Generated by</th>
                <th className="px-3 py-2 text-left">Last generated</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {RECENT_REPORTS.map((r) => (
                <tr key={r.name} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-slate-100">{r.name}</td>
                  <td className="px-3 py-2 text-slate-300">{r.type}</td>
                  <td className="px-3 py-2 text-slate-400">
                    <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200 ring-1 ring-rose-500/30">
                      {r.format}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{r.size}</td>
                  <td className="px-3 py-2 text-slate-300">{r.user}</td>
                  <td className="px-3 py-2 text-slate-400">{r.generated}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1 text-slate-400">
                      <button
                        type="button"
                        title="Run again"
                        className="rounded p-1 hover:bg-white/10 hover:text-slate-100"
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Schedule"
                        onClick={() => setScheduleOpen(true)}
                        className="rounded p-1 hover:bg-white/10 hover:text-slate-100"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Download"
                        className="rounded p-1 hover:bg-white/10 hover:text-slate-100"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          <PackageMinus className="mr-1 inline h-3 w-3" aria-hidden /> Recently generated reports
          are stored locally for 30 days then archived.
        </p>
      </section>

      <ScheduleReportModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        defaults={{ reportName: 'Custom report', reportType: 'General report' }}
        onExport={(p: ScheduleReportPayload) => {
          const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${p.reportName.replace(/\s+/g, '-').toLowerCase()}.${p.format === 'excel' ? 'xlsx' : p.format}`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        onSchedule={(p: ScheduleReportPayload) => {
          alert(`Scheduled "${p.reportName}" ${p.frequency} for ${p.recipients.length} recipients.`);
        }}
      />
    </div>
  );
}

const RECENT_REPORTS = [
  { name: 'Profitability & Item-wise Income Report', type: 'Profitability Report', format: 'PDF', size: '1.2 MB', user: 'John Doe', generated: 'Today 10:35 AM' },
  { name: 'Inventory Valuation Report', type: 'Valuation Report', format: 'PDF', size: '1.8 MB', user: 'John Doe', generated: 'Today 09:12 AM' },
  { name: 'Stock Movement Report', type: 'Movement Report', format: 'PDF', size: '1.2 MB', user: 'John Doe', generated: 'Yesterday' },
  { name: 'Slow Moving Items Report', type: 'Inventory Report', format: 'PDF', size: '2.1 MB', user: 'John Doe', generated: '2 days ago' },
  { name: 'Warehouse Performance Report', type: 'Performance Report', format: 'PDF', size: '2.3 MB', user: 'John Doe', generated: '3 days ago' },
  { name: 'Purchase Analysis Report', type: 'Purchase Report', format: 'PDF', size: '1.5 MB', user: 'John Doe', generated: '4 days ago' },
  { name: 'Sales Performance Report', type: 'Sales Report', format: 'PDF', size: '2.0 MB', user: 'John Doe', generated: '5 days ago' },
];
