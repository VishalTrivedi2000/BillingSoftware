import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, FileSpreadsheet } from 'lucide-react';
import type { InvoiceSummaryDto, PurchaseBillSummaryDto } from '../../entities/billing';
import type { AuthUserSummary } from '../../entities/auth-types';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../auth/authSlice';
import { downloadCsv } from './exportCsv';
import { ReportFiltersBar } from './ReportFiltersBar';
import type { PeriodPresetId } from './dateRangePresets';
import { rangeForPreset } from './dateRangePresets';
import { fmtDateOnly, fmtInr } from './reportFormat';

type Row =
  | { kind: 'sale'; key: string; when: string; party: string; doc: string; amount: number; balance: number; status: string; href: string }
  | { kind: 'purchase'; key: string; when: string; party: string; doc: string; amount: number; balance: number; status: string; href: string };

async function fetchInvoices(from: string, to: string): Promise<InvoiceSummaryDto[]> {
  const qs = new URLSearchParams({ take: '500', issueFrom: from, issueTo: to });
  return apiJsonAuth<InvoiceSummaryDto[]>(`/v1/invoices?${qs.toString()}`);
}

async function fetchPurchases(from: string, to: string): Promise<PurchaseBillSummaryDto[]> {
  const qs = new URLSearchParams({ take: '500', receivedFrom: from, receivedTo: to });
  return apiJsonAuth<PurchaseBillSummaryDto[]>(`/v1/purchases?${qs.toString()}`);
}

function mergeRows(invoices: InvoiceSummaryDto[], purchases: PurchaseBillSummaryDto[]): Row[] {
  const saleRows: Row[] = invoices.map((r) => ({
    kind: 'sale' as const,
    key: `s-${r.invoiceId}`,
    when: r.issueUtc,
    party: r.customerName,
    doc: r.invoiceNumber ?? `#${r.invoiceId}`,
    amount: r.totalAmount,
    balance: r.balanceDue ?? 0,
    status: r.status,
    href: `/invoices/${r.invoiceId}`,
  }));
  const purRows: Row[] = purchases.map((r) => ({
    kind: 'purchase' as const,
    key: `p-${r.purchaseBillId}`,
    when: r.receivedUtc,
    party: r.supplierName,
    doc: r.purchaseNumber ?? `#${r.purchaseBillId}`,
    amount: r.totalAmount,
    balance: r.balanceDue ?? 0,
    status: r.status,
    href: `/purchases/${r.purchaseBillId}`,
  }));
  const all = [...saleRows, ...purRows];
  all.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  return all;
}

type Props = {
  headline: string;
  sub: string;
};

export function MergedLedgerReportPage({ headline, sub }: Props) {
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

  const canInv = authMeQ.data?.permissions?.includes('invoices.read') ?? false;
  const canPur = authMeQ.data?.permissions?.includes('purchases.read') ?? false;

  const invQ = useQuery({
    queryKey: ['reports-ledger-inv', workplaceOrgId, fromDate, toDate],
    queryFn: () => fetchInvoices(fromDate, toDate),
    enabled: canInv && !!fromDate && !!toDate,
    retry: 1,
  });

  const purQ = useQuery({
    queryKey: ['reports-ledger-pur', workplaceOrgId, fromDate, toDate],
    queryFn: () => fetchPurchases(fromDate, toDate),
    enabled: canPur && !!fromDate && !!toDate,
    retry: 1,
  });

  const merged = useMemo(
    () => mergeRows(canInv ? invQ.data ?? [] : [], canPur ? purQ.data ?? [] : []),
    [canInv, canPur, invQ.data, purQ.data],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return merged;
    return merged.filter((r) => `${r.party} ${r.doc} ${r.kind}`.toLowerCase().includes(s));
  }, [merged, search]);

  const loading = (canInv && invQ.isLoading) || (canPur && purQ.isLoading);
  const errored = (canInv && invQ.isError) || (canPur && purQ.isError);

  function exportCsvClick() {
    const headers = ['Date', 'Document', 'Party', 'Type', 'Amount', 'Balance', 'Status'];
    const rows = filtered.map((r) => [
      fmtDateOnly(r.when),
      r.doc,
      r.party,
      r.kind === 'sale' ? 'Sale' : 'Purchase',
      r.amount.toFixed(2),
      r.balance.toFixed(2),
      r.status,
    ].map(String));
    downloadCsv(`${headline.replace(/\s+/g, '_').toLowerCase()}_${fromDate}_${toDate}.csv`, headers, rows);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-400/90">Reports</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">{headline}</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">{sub}</p>
        </div>
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

      <ReportFiltersBar preset={preset} onPresetChange={setPreset} fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} search={search} onSearchChange={setSearch} />

      {!canInv && !canPur && (
        <div role="alert" className="workspace-panel border border-amber-500/25 bg-amber-500/10 px-6 py-4 text-sm text-amber-100">
          You need <span className="font-mono">invoices.read</span> and/or <span className="font-mono">purchases.read</span> for this merged register.
        </div>
      )}

      {loading && (canInv || canPur) && (
        <div className="workspace-panel flex items-center gap-3 px-6 py-10 text-slate-400">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" aria-hidden />
          Loading ledger…
        </div>
      )}

      {errored && (
        <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-6 py-4 text-sm text-rose-100">
          Part of this report failed to load. Retry after checking API connectivity.
        </div>
      )}

      {(canInv || canPur) && !loading && (
        <section className="workspace-panel overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3 text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-300">{filtered.length}</span> row(s)
            {!canInv && ' · Sales hidden (no invoices.read)'}
            {!canPur && ' · Purchases hidden (no purchases.read)'}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Party</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      Nothing in range for the streams you can access.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.key} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{fmtDateOnly(r.when)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.doc}</td>
                    <td className="px-4 py-3 text-slate-200">{r.party}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.kind === 'sale'
                            ? 'rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300'
                            : 'rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300'
                        }
                      >
                        {r.kind === 'sale' ? 'Sale' : 'Purchase'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">{fmtInr(r.amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">{fmtInr(r.balance)}</td>
                    <td className="px-4 py-3 text-slate-400">{r.status}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={r.href} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300">
                        View
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
