import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Banknote, CircleDollarSign, FileText, Layers3, Users } from 'lucide-react';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import type { InvoiceSummaryDto, SalesSummaryDto } from '../../entities/billing';

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

async function fetchSalesSummary(): Promise<SalesSummaryDto> {
  return apiJsonAuth<SalesSummaryDto>('/v1/sales/summary');
}

async function fetchRecentInvoices(): Promise<InvoiceSummaryDto[]> {
  return apiJsonAuth<InvoiceSummaryDto[]>('/v1/invoices?take=25');
}

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof Banknote;
}) {
  return (
    <div className="workspace-panel border border-white/10 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
          <p className="mt-2 font-mono text-xl font-bold tracking-tight text-white sm:text-2xl">{value}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function SalesHubPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;
  const queryReady = authed && workplace != null;

  const summaryQ = useQuery({
    queryKey: ['sales-summary', workplaceOrgId],
    queryFn: fetchSalesSummary,
    retry: 1,
    enabled: queryReady,
  });

  const invoicesQ = useQuery({
    queryKey: ['sales-recent-invoices', workplaceOrgId],
    queryFn: fetchRecentInvoices,
    retry: 1,
    enabled: queryReady,
  });

  const rows = invoicesQ.data ?? [];
  const openCount = useMemo(() => rows.filter((r) => !r.status?.toLowerCase().includes('paid')).length, [rows]);

  const s = summaryQ.data;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400/90">Sales management</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">Sales workspace</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Posted invoices, receipts captured on invoice detail, and receivables snapshot for the active organization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/invoices/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            New invoice
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to="/invoices"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            All invoices
          </Link>
          <Link
            to="/customers"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Customers
          </Link>
        </div>
      </header>

      {summaryQ.isError && (
        <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          Could not load sales summary. Ensure you have <span className="font-mono">invoices.read</span>.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Posted invoices"
          value={s != null ? String(s.postedInvoiceCount) : summaryQ.isLoading ? '…' : '—'}
          hint="Posted or fully paid bill runs in this org."
          icon={Layers3}
        />
        <MetricCard
          title="Total billed"
          value={s != null ? fmtInr(s.totalInvoicedAmount) : summaryQ.isLoading ? '…' : '—'}
          hint="Sum of invoice totals (posted / paid)."
          icon={FileText}
        />
        <MetricCard
          title="Collected"
          value={s != null ? fmtInr(s.totalCollectedAmount) : summaryQ.isLoading ? '…' : '—'}
          hint="Sum of receipts recorded against invoices."
          icon={Banknote}
        />
        <MetricCard
          title="Outstanding"
          value={s != null ? fmtInr(s.totalOutstandingAmount) : summaryQ.isLoading ? '…' : '—'}
          hint="Positive balances due across open invoices."
          icon={CircleDollarSign}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="workspace-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent invoices</h2>
              <p className="mt-0.5 text-xs text-slate-500">Latest {Math.min(rows.length, 25)} from the list API · quick drill-down</p>
            </div>
            <Link to="/invoices" className="text-sm font-medium text-blue-400 hover:text-blue-300">
              Open full list →
            </Link>
          </div>
          {invoicesQ.isLoading ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">Loading…</p>
          ) : invoicesQ.isError ? (
            <p className="px-5 py-12 text-center text-sm text-rose-300">Could not load invoices.</p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">No invoices yet. Create one to see it here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Invoice</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Issued</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((inv) => (
                    <tr key={inv.invoiceId} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
                      <td className="px-5 py-3">
                        <Link className="font-mono font-semibold text-blue-300 hover:text-blue-200" to={`/invoices/${inv.invoiceId}`}>
                          {inv.invoiceNumber ?? `#${inv.invoiceId}`}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-300">{inv.customerName}</td>
                      <td className="px-5 py-3 text-slate-400">{fmtDate(inv.issueUtc)}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-300 ring-1 ring-white/10">
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-slate-100">{fmtInr(inv.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="workspace-panel p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Users className="h-4 w-4 text-slate-400" aria-hidden />
              Buyers
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Customers drive invoice headers. Maintain contacts under Masters before billing new parties.
            </p>
            <Link
              to="/customers"
              className="mt-4 inline-flex w-full justify-center rounded-xl border border-white/12 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.07]"
            >
              Manage customers
            </Link>
          </div>
          <div className="workspace-panel border border-amber-500/15 bg-amber-500/[0.06] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">Pipeline note</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
              Quotations and sales orders are not in this slice yet—this hub focuses on issued invoices and receipts (
              <span className="font-mono text-[10px]">invoicePayments.record</span> on invoice detail).
            </p>
            <p className="mt-3 text-xs text-slate-400">
              List preview: <span className="font-medium text-slate-300">{openCount}</span> of {rows.length} rows not marked paid (label-only).
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
