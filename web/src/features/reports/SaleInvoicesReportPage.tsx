import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Download, FileSpreadsheet, Printer } from 'lucide-react';
import type { InvoiceSummaryDto } from '../../entities/billing';
import type { AuthUserSummary } from '../../entities/auth-types';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../auth/authSlice';
import { downloadCsv } from './exportCsv';
import { ReportFiltersBar } from './ReportFiltersBar';
import type { PeriodPresetId } from './dateRangePresets';
import { rangeForPreset } from './dateRangePresets';
import { fmtDateOnly, fmtInr } from './reportFormat';

function invoiceRowStatus(inv: InvoiceSummaryDto): { label: string; className: string } {
  const bal = inv.balanceDue ?? inv.totalAmount - (inv.amountPaid ?? 0);
  if (inv.status.toLowerCase() === 'paid' || bal <= 0.009) {
    return { label: 'Paid', className: 'bg-emerald-500/15 text-emerald-300' };
  }
  if (inv.status.toLowerCase() === 'posted' && bal > 0.009) {
    return { label: 'Unpaid', className: 'bg-rose-500/15 text-rose-300' };
  }
  return { label: inv.status, className: 'bg-white/10 text-slate-300' };
}

function paymentLabel(inv: InvoiceSummaryDto): string {
  if ((inv.balanceDue ?? 0) >= inv.totalAmount - 0.009 && !inv.lastPaymentChannel) return '—';
  return inv.lastPaymentChannel?.trim() || 'Payment';
}

async function fetchInvoices(from: string, to: string): Promise<InvoiceSummaryDto[]> {
  const qs = new URLSearchParams({
    take: '500',
    issueFrom: from,
    issueTo: to,
  });
  return apiJsonAuth<InvoiceSummaryDto[]>(`/v1/invoices?${qs.toString()}`);
}

export function SaleInvoicesReportPage() {
  const workplaceOrgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;
  const initial = useMemo(() => rangeForPreset('this_month'), []);

  const [preset, setPreset] = useState<PeriodPresetId>('this_month');
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (preset === 'custom') return;
    const r = rangeForPreset(preset);
    setFromDate(r.from);
    setToDate(r.to);
  }, [preset]);

  const authMeQ = useQuery({
    queryKey: ['auth-me', workplaceOrgId],
    queryFn: () => apiJsonAuth<AuthUserSummary>('/v1/auth/me'),
    staleTime: 60_000,
  });

  const canRead = authMeQ.data?.permissions?.includes('invoices.read') ?? false;

  const q = useQuery({
    queryKey: ['reports-sale-invoices', workplaceOrgId, fromDate, toDate],
    queryFn: () => fetchInvoices(fromDate, toDate),
    enabled: canRead && !!fromDate && !!toDate,
    retry: 1,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rows = q.data ?? [];
    if (!s) return rows;
    return rows.filter((r) => {
      const hay = `${r.customerName} ${r.invoiceNumber ?? ''} ${r.invoiceId}`.toLowerCase();
      return hay.includes(s);
    });
  }, [q.data, search]);

  const kpis = useMemo(() => {
    let total = 0;
    let received = 0;
    let balance = 0;
    for (const r of filtered) {
      total += r.totalAmount;
      received += r.amountPaid ?? 0;
      balance += r.balanceDue ?? Math.max(0, r.totalAmount - (r.amountPaid ?? 0));
    }
    return { total, received, balance, count: filtered.length };
  }, [filtered]);

  function exportCsvClick() {
    const headers = ['Date', 'Invoice no', 'Party', 'Transaction', 'Payment type', 'Amount', 'Balance', 'Due date', 'Status'];
    const rows = filtered.map((r) => {
      const st = invoiceRowStatus(r).label;
      return [
        fmtDateOnly(r.issueUtc),
        r.invoiceNumber ?? String(r.invoiceId),
        r.customerName,
        'Sale',
        paymentLabel(r),
        r.totalAmount.toFixed(2),
        (r.balanceDue ?? 0).toFixed(2),
        '—',
        st,
      ].map(String);
    });
    downloadCsv(`sale-invoices_${fromDate}_${toDate}.csv`, headers, rows);
  }

  return (
    <div className="report-print-root mx-auto max-w-7xl space-y-6 px-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-400/90">Reports</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Sale invoices</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Filter by issue date, search parties, export CSV. Layout inspired by typical billing dashboards (sale register).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </button>
          <button
            type="button"
            onClick={exportCsvClick}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
        </div>
      </div>

      <ReportFiltersBar
        preset={preset}
        onPresetChange={setPreset}
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Party name or invoice #…"
      />

      {!canRead && (
        <div role="alert" className="workspace-panel border border-amber-500/25 bg-amber-500/10 px-6 py-4 text-sm text-amber-100">
          You need <span className="font-mono">invoices.read</span> to run this report.
        </div>
      )}

      {q.isLoading && canRead && (
        <div className="workspace-panel flex items-center gap-3 px-6 py-10 text-slate-400">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" aria-hidden />
          Loading invoices…
        </div>
      )}

      {q.isError && canRead && (
        <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-6 py-4 text-sm text-rose-100">
          Could not load invoices for this range.
        </div>
      )}

      {canRead && q.data && (
        <>
          <section className="workspace-panel overflow-hidden p-6">
            <h2 className="text-sm font-semibold text-slate-300">Total sales amount</h2>
            <p className="mt-2 text-4xl font-bold tabular-nums text-white">{fmtInr(kpis.total)}</p>
            <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-400">
              <span>
                Received: <span className="font-semibold text-emerald-300">{fmtInr(kpis.received)}</span>
              </span>
              <span>
                Balance: <span className="font-semibold text-amber-300">{fmtInr(kpis.balance)}</span>
              </span>
              <span>{kpis.count} row(s) after search</span>
            </div>
          </section>

          <section className="workspace-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-200">Transactions</h2>
              <Download className="h-4 w-4 text-slate-600" aria-hidden />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Invoice no</th>
                    <th className="px-4 py-3">Party name</th>
                    <th className="px-4 py-3">Transaction</th>
                    <th className="px-4 py-3">Payment type</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Due date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                        No invoices in this period (or nothing matches search).
                      </td>
                    </tr>
                  )}
                  {filtered.map((r) => {
                    const st = invoiceRowStatus(r);
                    return (
                      <tr key={r.invoiceId} className="hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-300">{fmtDateOnly(r.issueUtc)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.invoiceNumber ?? `#${r.invoiceId}`}</td>
                        <td className="px-4 py-3 text-slate-200">{r.customerName}</td>
                        <td className="px-4 py-3 text-slate-400">Sale</td>
                        <td className="px-4 py-3 text-slate-400">{paymentLabel(r)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-200">{fmtInr(r.totalAmount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-200">{fmtInr(r.balanceDue ?? 0)}</td>
                        <td className="px-4 py-3 text-slate-600">—</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/invoices/${r.invoiceId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
                          >
                            Open
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
