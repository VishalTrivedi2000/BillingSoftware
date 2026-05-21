import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Award,
  Building2,
  Download,
  HandCoins,
  Plus,
  Search,
  ShoppingCart,
  Star,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';
import type {
  CustomerDto,
  InvoiceSummaryDto,
  PartyDto,
  PurchaseBillSummaryDto,
} from '../../entities/billing';
import { HorizontalBars, KpiTile, LineChart } from '../../shared/ui/charts';
import { fmtInr } from '../inventory/inventoryHelpers';

type Tab = 'suppliers' | 'customers';

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

export function BusinessPartnersHubPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const ready = authed && workplace != null;

  const [tab, setTab] = useState<Tab>('suppliers');
  const [search, setSearch] = useState('');

  const partiesQ = useQuery({
    queryKey: ['partners-hub-parties'],
    queryFn: () => apiJsonAuth<PartyDto[]>('/v1/parties?max=400'),
    enabled: ready,
    retry: 1,
  });

  const customersQ = useQuery({
    queryKey: ['partners-hub-customers'],
    queryFn: () => apiJsonAuth<CustomerDto[]>('/v1/customers?max=400'),
    enabled: ready,
    retry: 1,
  });

  const invoicesQ = useQuery({
    queryKey: ['partners-hub-invoices'],
    queryFn: () => apiJsonAuth<InvoiceSummaryDto[]>('/v1/invoices?take=200'),
    enabled: ready,
    retry: 1,
  });

  const purchasesQ = useQuery({
    queryKey: ['partners-hub-purchases'],
    queryFn: () => apiJsonAuth<PurchaseBillSummaryDto[]>('/v1/purchases?take=200'),
    enabled: ready,
    retry: 1,
  });

  const parties = partiesQ.data ?? [];
  const customers = customersQ.data ?? [];
  const invoices = invoicesQ.data ?? [];
  const purchases = purchasesQ.data ?? [];

  const supplierStats = useMemo(() => {
    const stats = new Map<
      number,
      { partyId: number; name: string; spend: number; pending: number; orders: number; lastDate?: string }
    >();
    for (const p of purchases) {
      const cur = stats.get(p.partyId) ?? {
        partyId: p.partyId,
        name: p.supplierName,
        spend: 0,
        pending: 0,
        orders: 0,
      };
      cur.spend += p.totalAmount;
      cur.pending += p.balanceDue;
      cur.orders += 1;
      if (!cur.lastDate || p.receivedUtc > cur.lastDate) cur.lastDate = p.receivedUtc;
      stats.set(p.partyId, cur);
    }
    return stats;
  }, [purchases]);

  const customerStats = useMemo(() => {
    const stats = new Map<
      number,
      { customerId: number; name: string; revenue: number; outstanding: number; invoices: number; lastDate?: string }
    >();
    for (const inv of invoices) {
      const cur = stats.get(inv.customerId) ?? {
        customerId: inv.customerId,
        name: inv.customerName,
        revenue: 0,
        outstanding: 0,
        invoices: 0,
      };
      cur.revenue += inv.totalAmount;
      cur.outstanding += inv.balanceDue;
      cur.invoices += 1;
      if (!cur.lastDate || inv.issueUtc > cur.lastDate) cur.lastDate = inv.issueUtc;
      stats.set(inv.customerId, cur);
    }
    return stats;
  }, [invoices]);

  const totalSupplierSpend = useMemo(
    () => purchases.reduce((s, p) => s + p.totalAmount, 0),
    [purchases],
  );
  const totalPayables = useMemo(
    () => purchases.reduce((s, p) => s + p.balanceDue, 0),
    [purchases],
  );
  const totalCustomerRevenue = useMemo(
    () => invoices.reduce((s, p) => s + p.totalAmount, 0),
    [invoices],
  );
  const totalReceivables = useMemo(
    () => invoices.reduce((s, p) => s + p.balanceDue, 0),
    [invoices],
  );

  const topSuppliers = useMemo(
    () =>
      Array.from(supplierStats.values())
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 6),
    [supplierStats],
  );
  const topCustomers = useMemo(
    () =>
      Array.from(customerStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6),
    [customerStats],
  );

  const dates = lastNDates(7);

  const supplierTrend = useMemo(() => {
    const map = new Map(dates.map((d) => [d.iso, 0]));
    for (const p of purchases) {
      const day = p.receivedUtc.slice(0, 10);
      if (map.has(day)) map.set(day, (map.get(day) ?? 0) + p.totalAmount);
    }
    return dates.map((d) => map.get(d.iso) ?? 0);
  }, [dates, purchases]);

  const customerTrend = useMemo(() => {
    const map = new Map(dates.map((d) => [d.iso, 0]));
    for (const p of invoices) {
      const day = p.issueUtc.slice(0, 10);
      if (map.has(day)) map.set(day, (map.get(day) ?? 0) + p.totalAmount);
    }
    return dates.map((d) => map.get(d.iso) ?? 0);
  }, [dates, invoices]);

  const filteredSuppliers = useMemo(() => {
    const supplierParties = parties.filter((p) => p.kind === 'supplier' || p.kind === 'both');
    if (!search) return supplierParties;
    const s = search.toLowerCase();
    return supplierParties.filter(
      (p) =>
        p.displayName.toLowerCase().includes(s) ||
        (p.taxId ?? '').toLowerCase().includes(s) ||
        (p.email ?? '').toLowerCase().includes(s),
    );
  }, [parties, search]);

  const filteredCustomers = useMemo(() => {
    if (!search) return customers;
    const s = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.email ?? '').toLowerCase().includes(s) ||
        (c.phone ?? '').toLowerCase().includes(s),
    );
  }, [customers, search]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Masters · partners</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Business Partners
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Unified view of suppliers and customers across your organization with spend, revenue,
            and activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <Link
            to={tab === 'suppliers' ? '/parties' : '/customers'}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            {tab === 'suppliers' ? <UserPlus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {tab === 'suppliers' ? 'Add supplier' : 'Add customer'}
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          title="Total suppliers"
          value={parties
            .filter((p) => p.kind === 'supplier' || p.kind === 'both')
            .length.toLocaleString()}
          hint="Active in catalog"
          icon={Building2}
          tone="violet"
        />
        <KpiTile
          title="Total customers"
          value={customers.length.toLocaleString()}
          hint="Active in catalog"
          icon={Users}
          tone="blue"
        />
        <KpiTile
          title="Total payables"
          value={fmtInr(totalPayables)}
          hint={`Across ${supplierStats.size} suppliers`}
          icon={TrendingDown}
          tone="rose"
        />
        <KpiTile
          title="Total receivables"
          value={fmtInr(totalReceivables)}
          hint={`Across ${customerStats.size} customers`}
          icon={TrendingUp}
          tone="emerald"
        />
      </section>

      <section className="workspace-panel border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
          <div className="flex items-center gap-1.5">
            <TabButton active={tab === 'suppliers'} onClick={() => setTab('suppliers')} icon={Building2}>
              Suppliers ({parties.filter((p) => p.kind === 'supplier' || p.kind === 'both').length})
            </TabButton>
            <TabButton active={tab === 'customers'} onClick={() => setTab('customers')} icon={Users}>
              Customers ({customers.length})
            </TabButton>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'suppliers' ? 'Search suppliers' : 'Search customers'}
              className="w-64 rounded-lg border border-white/10 bg-slate-900/80 py-1.5 pl-8 pr-3 text-xs text-white focus:border-blue-400 focus:outline-none"
            />
          </div>
        </div>

        {tab === 'suppliers' ? (
          <SupplierDashboard
            spend={totalSupplierSpend}
            trend={supplierTrend}
            dates={dates.map((d) => d.label)}
            topSuppliers={topSuppliers}
            filtered={filteredSuppliers}
            statsMap={supplierStats}
          />
        ) : (
          <CustomerDashboard
            revenue={totalCustomerRevenue}
            trend={customerTrend}
            dates={dates.map((d) => d.label)}
            topCustomers={topCustomers}
            filtered={filteredCustomers}
            statsMap={customerStats}
          />
        )}
      </section>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-blue-500/15 text-blue-200 ring-1 ring-blue-500/30'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function SupplierDashboard({
  spend,
  trend,
  dates,
  topSuppliers,
  filtered,
  statsMap,
}: {
  spend: number;
  trend: number[];
  dates: string[];
  topSuppliers: Array<{ partyId: number; name: string; spend: number; pending: number; orders: number; lastDate?: string }>;
  filtered: PartyDto[];
  statsMap: Map<number, { partyId: number; name: string; spend: number; pending: number; orders: number; lastDate?: string }>;
}) {
  return (
    <div className="grid gap-0 lg:grid-cols-[2fr,1fr]">
      <div className="border-b border-white/5 p-4 lg:border-b-0 lg:border-r">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Supplier spend trend
            </h2>
            <p className="text-[11px] text-slate-500">Daily PO value over last 7 days</p>
          </div>
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            {fmtInr(spend)}
          </span>
        </header>
        <LineChart
          xLabels={dates}
          series={[{ name: 'Spend', color: '#a78bfa', values: trend, area: true }]}
          height={220}
          formatY={(n) => fmtInr(n)}
        />
      </div>
      <div className="p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
            Top suppliers
          </h2>
          <Award className="h-3.5 w-3.5 text-amber-300" />
        </header>
        <HorizontalBars
          rows={topSuppliers.map((s) => ({
            name: s.name,
            value: s.spend,
            sub: `${s.orders} POs · ${fmtInr(s.pending)} pending`,
          }))}
          formatValue={(v) => fmtInr(v)}
          barColor="#a78bfa"
        />
      </div>

      <div className="col-span-full overflow-x-auto border-t border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Contact</th>
              <th className="px-3 py-2 text-right">POs</th>
              <th className="px-3 py-2 text-right">Total spend</th>
              <th className="px-3 py-2 text-right">Pending</th>
              <th className="px-3 py-2 text-left">Last activity</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.slice(0, 30).map((p) => {
              const s = statsMap.get(p.partyId);
              return (
                <tr key={p.partyId} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-100">{p.displayName}</div>
                    <div className="text-xs text-slate-500">{p.taxId ?? 'No tax ID'}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">
                    <div>{p.email ?? '—'}</div>
                    <div className="text-slate-500">{p.phone ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-200">
                    {s?.orders ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-300">
                    {fmtInr(s?.spend ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-amber-300">
                    {fmtInr(s?.pending ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {s?.lastDate ? new Date(s.lastDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                        p.isActive
                          ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                          : 'bg-slate-500/15 text-slate-300 ring-slate-500/30'
                      }`}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to="/purchases/new"
                      className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/15 px-2 py-1 text-[11px] font-semibold text-blue-200 hover:bg-blue-500/25"
                    >
                      <ShoppingCart className="h-3 w-3" /> New PO
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                  No suppliers match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerDashboard({
  revenue,
  trend,
  dates,
  topCustomers,
  filtered,
  statsMap,
}: {
  revenue: number;
  trend: number[];
  dates: string[];
  topCustomers: Array<{ customerId: number; name: string; revenue: number; outstanding: number; invoices: number; lastDate?: string }>;
  filtered: CustomerDto[];
  statsMap: Map<number, { customerId: number; name: string; revenue: number; outstanding: number; invoices: number; lastDate?: string }>;
}) {
  return (
    <div className="grid gap-0 lg:grid-cols-[2fr,1fr]">
      <div className="border-b border-white/5 p-4 lg:border-b-0 lg:border-r">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
              Customer revenue trend
            </h2>
            <p className="text-[11px] text-slate-500">Daily invoice value over last 7 days</p>
          </div>
          <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300 ring-1 ring-blue-500/30">
            {fmtInr(revenue)}
          </span>
        </header>
        <LineChart
          xLabels={dates}
          series={[{ name: 'Revenue', color: '#34d399', values: trend, area: true }]}
          height={220}
          formatY={(n) => fmtInr(n)}
        />
      </div>
      <div className="p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">
            Top customers
          </h2>
          <Star className="h-3.5 w-3.5 text-amber-300" />
        </header>
        <HorizontalBars
          rows={topCustomers.map((c) => ({
            name: c.name,
            value: c.revenue,
            sub: `${c.invoices} invoices · ${fmtInr(c.outstanding)} outstanding`,
          }))}
          formatValue={(v) => fmtInr(v)}
          barColor="#34d399"
        />
      </div>

      <div className="col-span-full overflow-x-auto border-t border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Contact</th>
              <th className="px-3 py-2 text-right">Invoices</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2 text-left">Last activity</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.slice(0, 30).map((c) => {
              const s = statsMap.get(c.customerId);
              const overdue = (s?.outstanding ?? 0) > 0;
              return (
                <tr key={c.customerId} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-100">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.taxId ?? 'No tax ID'}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">
                    <div>{c.email ?? '—'}</div>
                    <div className="text-slate-500">{c.phone ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-200">
                    {s?.invoices ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-300">
                    {fmtInr(s?.revenue ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-amber-300">
                    {fmtInr(s?.outstanding ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {s?.lastDate ? new Date(s.lastDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                        overdue
                          ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                      }`}
                    >
                      {overdue ? 'Overdue' : 'Up to date'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to="/invoices/new"
                      className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/15 px-2 py-1 text-[11px] font-semibold text-blue-200 hover:bg-blue-500/25"
                    >
                      <HandCoins className="h-3 w-3" /> New invoice
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                  No customers match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
