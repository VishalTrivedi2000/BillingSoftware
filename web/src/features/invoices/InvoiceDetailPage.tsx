import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText, Loader2, Printer } from 'lucide-react';
import type { InvoiceDetailDto } from '../../entities/billing';
import type { AuthUserSummary, OrganizationMembership } from '../../entities/auth-types';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import { InvoiceDocument } from './InvoiceDocument';
import { downloadInvoicePdf, invoicePdfFilename, printInvoicePdf } from './invoicePdf';
import { InvoiceSettlementSection } from './InvoiceSettlementSection';

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
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;

  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [printErr, setPrintErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['invoice-detail', id, workplaceOrgId],
    queryFn: () => apiJsonAuth<InvoiceDetailDto>(`/v1/invoices/${id}`),
    enabled: Number.isFinite(id) && id > 0,
    retry: 1,
  });

  const memQ = useQuery({
    queryKey: ['org-memberships', workplace?.tenantId, workplace?.organizationId],
    queryFn: () => apiJsonAuth<OrganizationMembership[]>('/v1/organizations/my-memberships'),
    enabled: Boolean(authed && workplace),
    staleTime: 60_000,
  });

  const authMeQ = useQuery({
    queryKey: ['auth-me-header'],
    enabled: authed,
    queryFn: () => apiJsonAuth<AuthUserSummary>('/v1/auth/me'),
    staleTime: 60_000,
    retry: 1,
  });

  const canRecordSettlement = authMeQ.data?.permissions?.includes('invoicePayments.record') ?? false;

  const organization = useMemo(() => {
    const m = memQ.data?.find((row) => row.organizationId === workplace?.organizationId && row.tenantId === workplace?.tenantId);
    return {
      name: m?.organizationName ?? (workplace ? `Organization ${workplace.organizationId}` : 'Organization'),
      code: m?.organizationCode ?? '',
    };
  }, [memQ.data, workplace]);

  async function handleDownloadPdf() {
    const el = document.getElementById('invoice-print-surface');
    const inv = q.data;
    if (!el || !inv) return;
    setPdfBusy(true);
    try {
      await downloadInvoicePdf(el, invoicePdfFilename(inv.invoiceNumber, inv.invoiceId));
    } finally {
      setPdfBusy(false);
    }
  }

  async function handlePrintPdf() {
    const el = document.getElementById('invoice-print-surface');
    if (!(el instanceof HTMLElement)) {
      setPrintErr('Print layout not ready yet.');
      return;
    }
    setPrintErr(null);
    setPrintBusy(true);
    try {
      await printInvoicePdf(el);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not open print dialog.';
      setPrintErr(msg.slice(0, 240));
    } finally {
      setPrintBusy(false);
    }
  }

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
      <div className="no-print">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/invoices" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white">
            <ArrowLeft size={16} aria-hidden />
            All invoices
          </Link>
          {inv && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={printBusy}
                onClick={() => void handlePrintPdf()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-sm hover:bg-white/10 disabled:opacity-50"
              >
                {printBusy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
                ) : (
                  <Printer className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                )}
                Print PDF…
              </button>
              <button
                type="button"
                disabled={pdfBusy}
                onClick={() => void handleDownloadPdf()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 disabled:opacity-50"
              >
                {pdfBusy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                )}
                Download PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {printErr ? (
        <div role="alert" className="no-print workspace-panel border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {printErr}
        </div>
      ) : null}

      {q.isLoading && (
        <div className="no-print workspace-panel flex items-center gap-3 px-6 py-12 text-slate-400">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
          Loading invoice…
        </div>
      )}

      {q.isError && (
        <div role="alert" className="no-print workspace-panel border border-rose-500/25 bg-rose-500/10 px-6 py-6 text-sm text-rose-200">
          Invoice not found or you lack access for this workplace.
        </div>
      )}

      {inv && (
        <>
          <header className="no-print workspace-panel flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
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
              {inv.balanceDue > 0.009 && inv.status.toLowerCase() !== 'paid' && (
                <p className="mt-3 text-xs font-medium text-amber-200/95">Balance due {fmtInr(inv.balanceDue)}</p>
              )}
            </div>
          </header>

          <InvoiceSettlementSection
            invoice={inv}
            invoiceId={id}
            workplaceOrgId={workplaceOrgId}
            canRecord={canRecordSettlement}
          />

          <section className="no-print workspace-panel p-6">
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

          <p className="no-print text-center text-xs text-slate-500">
            Printable invoice below includes <span className="font-medium text-slate-400">{organization.name}</span>
            {organization.code ? (
              <>
                {' '}
                · <span className="font-mono text-slate-600">{organization.code}</span>
              </>
            ) : null}
            . Print opens your browser dialog (choose “Save as PDF” to export).
          </p>

          <div className="invoice-print-root px-0 pb-16">
            <InvoiceDocument invoice={inv} organization={organization} />
          </div>
        </>
      )}
    </div>
  );
}
