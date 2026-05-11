import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import type { InvoiceSummaryDto } from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { apiJsonAuth } from '../../shared/api/axiosClient';

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

export function InvoicesListPage() {
  const workplaceOrgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;

  const q = useQuery({
    queryKey: ['invoices-list', workplaceOrgId],
    queryFn: () => apiJsonAuth<InvoiceSummaryDto[]>('/v1/invoices?take=100'),
    retry: 1,
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-400/90">Billing</p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
            <FileText className="h-8 w-8 text-blue-400" aria-hidden />
            Invoices
          </h1>
          <p className="mt-2 max-w-none text-pretty text-sm text-slate-400">
            Scoped by JWT workplace (<span className="font-mono text-xs">tenant_id</span> /{' '}
            <span className="font-mono text-xs">org_id</span>) — list and totals are for the active workplace only.
          </p>
        </div>
        <Link
          to="/invoices/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500"
        >
          <Plus size={18} aria-hidden />
          New invoice
        </Link>
      </div>

      {q.isLoading && (
        <div className="workspace-panel flex items-center gap-3 px-6 py-10 text-slate-400">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" aria-hidden />
          Loading invoices…
        </div>
      )}

      {q.isError && (
        <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-6 py-6 text-sm text-rose-200">
          Could not load invoices. Check permissions (<span className="font-mono">invoices.read</span>) or API connectivity.
        </div>
      )}

      {q.data && q.data.length === 0 && (
        <div className="workspace-panel border border-dashed border-white/15 px-6 py-12 text-center">
          <p className="text-slate-400">No invoices in this organization yet.</p>
          <Link to="/invoices/new" className="mt-4 inline-block text-sm font-semibold text-blue-400 hover:underline">
            Create the first invoice
          </Link>
        </div>
      )}

      {q.data && q.data.length > 0 && (
        <div className="workspace-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Issued</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((inv) => (
                  <tr key={inv.invoiceId} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                    <td className="px-6 py-3">
                      <Link to={`/invoices/${inv.invoiceId}`} className="font-mono font-semibold text-blue-400 hover:text-blue-300 hover:underline">
                        {inv.invoiceNumber ?? `#${inv.invoiceId}`}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-slate-300">{inv.customerName}</td>
                    <td className="px-6 py-3 text-slate-500">{fmtDate(inv.issueUtc)}</td>
                    <td className="px-6 py-3">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-300">{inv.status}</span>
                    </td>
                    <td className="px-6 py-3 text-right font-medium tabular-nums text-slate-100">{fmtInr(inv.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
