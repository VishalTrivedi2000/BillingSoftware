import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, RefreshCw } from 'lucide-react';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { clearSession, selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import type { DashboardMetricsDto, InvoiceSummaryDto } from '../../entities/billing';

async function fetchHealth(): Promise<{ status: string; sql: string }> {
  return apiJsonAuth<{ status: string; sql: string }>('/v1/health');
}

async function fetchMetrics(): Promise<DashboardMetricsDto> {
  return apiJsonAuth<DashboardMetricsDto>('/v1/dashboard/metrics');
}

async function fetchRecentInvoices(): Promise<InvoiceSummaryDto[]> {
  return apiJsonAuth<InvoiceSummaryDto[]>('/v1/invoices?take=90');
}

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtDay(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function TrendMiniChart({ invoices }: { invoices: InvoiceSummaryDto[] }) {
  const series = useMemo(() => {
    const keys = lastNDates(7);
    const map = new Map<string, number>();
    for (const k of keys) map.set(k, 0);
    for (const inv of invoices) {
      try {
        const day = new Date(inv.issueUtc).toISOString().slice(0, 10);
        if (map.has(day)) map.set(day, (map.get(day) ?? 0) + inv.totalAmount);
      } catch {
        /* skip */
      }
    }
    return keys.map((k) => ({ key: k, total: map.get(k) ?? 0 }));
  }, [invoices]);

  const max = Math.max(...series.map((s) => s.total), 1);
  const w = 360;
  const h = 140;
  const pad = 12;
  const points = series.map((s, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(series.length - 1, 1);
    const y = h - pad - (s.total / max) * (h - pad * 2);
    return `${x},${y}`;
  });

  const area = `0,${h} ${points.join(' ')} ${w},${h}`;

  return (
    <div className="workspace-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Invoice totals (7-day window)</h2>
          <p className="mt-1 text-sm text-slate-500">
            Built from recent invoices in this organization — not a full ledger report.
          </p>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full min-w-[280px]" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fillInv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon fill="url(#fillInv)" points={area} />
          <polyline fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points.join(' ')} />
          {series.map((s, i) => {
            const x = pad + (i * (w - pad * 2)) / Math.max(series.length - 1, 1);
            const y = h - pad - (s.total / max) * (h - pad * 2);
            return <circle key={s.key} cx={x} cy={y} r="4" fill="#93c5fd" stroke="#1e3a8a" strokeWidth="1" />;
          })}
        </svg>
        <div className="mt-2 flex justify-between gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {series.map((s) => (
            <span key={s.key} className="flex-1 truncate text-center">
              {fmtDay(s.key + 'T12:00:00')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;

  const healthQ = useQuery({
    queryKey: ['health', workplaceOrgId],
    queryFn: fetchHealth,
    retry: 1,
  });

  const metricsQ = useQuery({
    queryKey: ['dashboard-metrics', workplaceOrgId],
    queryFn: fetchMetrics,
    retry: 1,
  });

  const invoicesQ = useQuery({
    queryKey: ['invoices-recent', workplaceOrgId],
    queryFn: fetchRecentInvoices,
    retry: 1,
  });

  const trendRows = invoicesQ.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-400/90">Executive overview</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">Billing dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Live aggregates from BSDB for the active JWT workplace. Switch organization under Profile to move tenant-scoped data.
          </p>
        </div>
        <Link
          to="/invoices/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
        >
          New invoice
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {/* View controls — structural parity with enterprise consoles; filters are honest placeholders until backend supports ranges */}
      <section className="workspace-panel p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[160px] flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Time range</label>
            <select
              disabled
              className="mt-2 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-500 outline-none"
              title="Server-side date filters ship with payments & reporting slices"
            >
              <option>Live snapshot (API)</option>
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Organization scope</label>
            <div className="mt-2 rounded-xl border border-white/10 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-200">
              {workplace ? (
                <>
                  Org <span className="font-mono text-blue-100">{workplace.organizationId}</span>
                  <span className="mx-2 text-blue-400/50">·</span>
                  Tenant <span className="font-mono text-blue-100">{workplace.tenantId}</span>
                </>
              ) : (
                <span className="text-slate-500">Workplace claims missing — sign out and sign in again.</span>
              )}
            </div>
          </div>
          <div className="min-w-[140px]">
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Presets</label>
            <select disabled className="mt-2 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-500">
              <option>Default workspace</option>
            </select>
          </div>
          <button
            type="button"
            disabled
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white opacity-60"
            title="Metrics already reflect current JWT scope"
          >
            Apply filters
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-600">
          Saved presets and rolling windows will tie into reporting endpoints; today numbers match{' '}
          <span className="font-mono text-slate-500">GET /v1/dashboard/metrics</span>.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Customers" value={metricsQ.data?.customerCount} loading={metricsQ.isLoading} error={metricsQ.isError} hint="In this org" />
        <MetricTile
          label="Active products"
          value={metricsQ.data?.activeProductCount}
          loading={metricsQ.isLoading}
          error={metricsQ.isError}
          hint="IsActive = 1"
        />
        <MetricTile label="Invoices" value={metricsQ.data?.invoiceCount} loading={metricsQ.isLoading} error={metricsQ.isError} hint="All statuses" />
        <MetricTile
          label="Total invoiced"
          value={metricsQ.data != null ? fmtInr(metricsQ.data.totalInvoicedAmount) : undefined}
          loading={metricsQ.isLoading}
          error={metricsQ.isError}
          hint="Excluding cancelled"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!invoicesQ.isLoading && !invoicesQ.isError && <TrendMiniChart invoices={trendRows} />}
          {invoicesQ.isLoading && (
            <div className="workspace-panel flex items-center gap-3 p-8 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin" aria-hidden />
              Loading trend data…
            </div>
          )}

          <section className="workspace-panel overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Activity className="h-5 w-5 text-blue-400" aria-hidden />
                  Recent invoices
                </h2>
                <p className="mt-1 text-sm text-slate-500">Latest postings for reconciliation — scoped by org claim.</p>
              </div>
              <Link to="/invoices" className="text-sm font-semibold text-blue-400 hover:text-blue-300">
                View all
              </Link>
            </div>

            <div className="overflow-x-auto px-2 pb-2">
              {invoicesQ.isLoading && (
                <div className="flex items-center gap-3 px-6 py-12 text-slate-400">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                  Loading…
                </div>
              )}
              {invoicesQ.isError && (
                <div role="alert" className="mx-4 my-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
                  Could not load invoices (offline or missing <span className="font-mono">invoices.read</span>).
                </div>
              )}
              {invoicesQ.data && invoicesQ.data.length === 0 && (
                <p className="px-6 py-12 text-center text-sm text-slate-500">
                  No invoices yet —{' '}
                  <Link to="/invoices/new" className="font-semibold text-blue-400 hover:underline">
                    create one
                  </Link>
                  .
                </p>
              )}
              {invoicesQ.data && invoicesQ.data.length > 0 && (
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Issued</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesQ.data.slice(0, 12).map((inv) => (
                      <tr key={inv.invoiceId} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 font-mono">
                          <Link to={`/invoices/${inv.invoiceId}`} className="font-semibold text-blue-400 hover:text-blue-300 hover:underline">
                            {inv.invoiceNumber ?? `#${inv.invoiceId}`}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{inv.customerName}</td>
                        <td className="px-4 py-3 text-slate-500">{fmtDate(inv.issueUtc)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-300">{inv.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-100">{fmtInr(inv.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="workspace-panel p-5">
            <h2 className="text-lg font-semibold text-white">Service health</h2>
            <p className="mt-1 text-sm text-slate-500">API + SQL connectivity from <span className="font-mono text-xs">/v1/health</span>.</p>
            <ul className="mt-5 space-y-3">
              <HealthRow name="BillingApp.Api" loading={healthQ.isLoading} ok={healthQ.isSuccess} detail={healthQ.data?.status} />
              <HealthRow
                name="SQL Server"
                loading={healthQ.isLoading}
                ok={healthQ.isSuccess && healthQ.data?.sql === 'connected'}
                detail={healthQ.data?.sql ? `Link ${healthQ.data.sql}` : undefined}
              />
            </ul>
            {healthQ.isError && (
              <div role="alert" className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                Health check failed — confirm <span className="font-mono">VITE_BASE_API_URL</span>, API is running, and CORS allows this origin. Endpoint is anonymous; persistent failures usually mean the API URL is wrong or unreachable.
                <button
                  type="button"
                  onClick={() => {
                    dispatch(clearSession());
                    window.location.href = '/login';
                  }}
                  className="mt-2 block font-semibold text-rose-300 underline"
                >
                  Re-authenticate
                </button>
              </div>
            )}
          </div>

          <div className="workspace-panel-soft p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Roadmap</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Next implementation-plan slices: <strong className="text-slate-300">payments</strong>, printable/PDF invoices, then{' '}
              <strong className="text-slate-300">SignalR</strong> live metrics (Part 7).
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  loading,
  error,
  hint,
}: {
  label: string;
  value: string | number | undefined;
  loading: boolean;
  error: boolean;
  hint?: string;
}) {
  return (
    <div className="workspace-panel p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-600">{hint}</p>}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
          Loading…
        </div>
      )}
      {error && !loading && <p className="mt-4 text-sm text-rose-400">Unavailable</p>}
      {!loading && !error && <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-white">{value ?? '—'}</p>}
      {!loading && !error && (
        <p className="mt-3 text-[11px] text-slate-600">Snapshot — compare periods when analytics endpoints land.</p>
      )}
    </div>
  );
}

function HealthRow({
  name,
  loading,
  ok,
  detail,
}: {
  name: string;
  loading: boolean;
  ok: boolean;
  detail?: string;
}) {
  return (
    <li className="workspace-panel-soft flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div>
        <p className="font-medium text-slate-200">{name}</p>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
      </div>
      {loading && <span className="text-xs text-slate-500">Checking…</span>}
      {!loading && (
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-200'
          }`}
        >
          {ok ? 'Healthy' : 'Check'}
        </span>
      )}
    </li>
  );
}
