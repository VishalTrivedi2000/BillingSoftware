import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText } from 'lucide-react';
import type { InvoiceDetailDto } from '../../entities/billing';
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

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const id = invoiceId ? Number(invoiceId) : NaN;
  const workplaceOrgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;

  const q = useQuery({
    queryKey: ['invoice-detail', id, workplaceOrgId],
    queryFn: () => apiJsonAuth<InvoiceDetailDto>(`/v1/invoices/${id}`),
    enabled: Number.isFinite(id) && id > 0,
    retry: 1,
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-6 py-6 text-sm text-rose-200">
        Invalid invoice id.
      </div>
    );
  }

  const inv = q.data;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link to="/invoices" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          All invoices
        </Link>
      </div>

      {q.isLoading && (
        <div className="workspace-panel flex items-center gap-3 px-6 py-12 text-slate-400">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" aria-hidden />
          Loading invoice…
        </div>
      )}

      {q.isError && (
        <div role="alert" className="workspace-panel border border-rose-500/25 bg-rose-500/10 px-6 py-6 text-sm text-rose-200">
          Invoice not found or you lack access for this workplace.
        </div>
      )}

      {inv && (
        <>
          <header className="workspace-panel flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
                <FileText size={24} aria-hidden />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</p>
                <h1 className="text-2xl font-bold text-white">{inv.invoiceNumber ?? `#${inv.invoiceId}`}</h1>
                <p className="mt-1 text-sm text-slate-400">
                  <span className="font-medium text-slate-200">{inv.customerName}</span>
                  <span className="mx-2 text-slate-600">·</span>
                  Issued {fmtDate(inv.issueUtc)}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
              <p className="text-2xl font-bold text-white">{fmtInr(inv.totalAmount)}</p>
              <p className="mt-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">{inv.status}</span>
                <span className="ml-2 font-mono text-xs text-slate-500">{inv.currency}</span>
              </p>
            </div>
          </header>

          <section className="workspace-panel p-6">
            <h2 className="text-lg font-semibold text-white">Line items</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Product</th>
                    <th className="py-2 pr-4 text-right">Qty</th>
                    <th className="py-2 pr-4 text-right">Unit</th>
                    <th className="py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((line) => (
                    <tr key={line.invoiceLineId} className="border-b border-white/5">
                      <td className="py-3 pr-4 text-slate-200">{line.description}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">{line.productId ?? '—'}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-400">{line.quantity}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-400">{fmtInr(line.unitPrice)}</td>
                      <td className="py-3 text-right font-medium tabular-nums text-slate-100">{fmtInr(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
