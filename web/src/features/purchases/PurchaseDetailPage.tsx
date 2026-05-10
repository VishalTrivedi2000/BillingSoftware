import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, LayoutTemplate, Loader2, Pencil, Printer, Truck } from 'lucide-react';
import axios from 'axios';
import { useMemo, useState } from 'react';
import type { PurchaseBillDetailDto } from '../../entities/billing';
import type { OrganizationMembership } from '../../entities/auth-types';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { apiJsonAuth, authApi } from '../../shared/api/axiosClient';
import { PurchasePrintSurface } from './PurchasePrintSurface';
import { downloadPurchasePdf, printPurchasePdf, purchasePdfFilename } from './purchasePdf';
import { usePurchasePrintPrefs } from './purchasePrintStorage';

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

export function PurchaseDetailPage() {
  const qc = useQueryClient();
  const { purchaseBillId } = useParams<{ purchaseBillId: string }>();
  const id = purchaseBillId ? Number(purchaseBillId) : NaN;
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;

  const [postDraftError, setPostDraftError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [printErr, setPrintErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['purchase-detail', id, workplaceOrgId],
    queryFn: () => apiJsonAuth<PurchaseBillDetailDto>(`/v1/purchases/${id}`),
    enabled: Number.isFinite(id) && id > 0,
    retry: 1,
  });

  const memQ = useQuery({
    queryKey: ['org-memberships', workplace?.tenantId, workplace?.organizationId],
    queryFn: () => apiJsonAuth<OrganizationMembership[]>('/v1/organizations/my-memberships'),
    enabled: Boolean(authed && workplace),
    staleTime: 60_000,
  });

  const organization = useMemo(() => {
    const m = memQ.data?.find((row) => row.organizationId === workplace?.organizationId && row.tenantId === workplace?.tenantId);
    return {
      name: m?.organizationName ?? (workplace ? `Organization ${workplace.organizationId}` : 'Organization'),
      code: m?.organizationCode ?? '',
    };
  }, [memQ.data, workplace]);

  const { prefs: printPrefs } = usePurchasePrintPrefs(workplaceOrgId);

  const postDraftMut = useMutation({
    mutationFn: async () => {
      await authApi.post(`/v1/purchases/drafts/${id}/post`);
    },
    onMutate: () => setPostDraftError(null),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['purchase-detail', id] });
      await qc.invalidateQueries({ queryKey: ['purchases-list'] });
      await qc.invalidateQueries({ queryKey: ['products-pick'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
    onError: (e: unknown) => {
      const msg =
        axios.isAxiosError(e) && e.response?.data
          ? typeof e.response.data === 'string'
            ? e.response.data
            : JSON.stringify(e.response.data)
          : e instanceof Error
            ? e.message
            : 'Could not post draft.';
      setPostDraftError(msg.slice(0, 280));
    },
  });

  async function handleDownloadPdf() {
    const el = document.getElementById('purchase-print-surface');
    const bill = q.data;
    if (!el || !bill) return;
    setPdfBusy(true);
    try {
      await downloadPurchasePdf(el, purchasePdfFilename(bill.purchaseNumber, bill.purchaseBillId));
    } finally {
      setPdfBusy(false);
    }
  }

  async function handlePrintPdf() {
    const el = document.getElementById('purchase-print-surface');
    if (!(el instanceof HTMLElement)) {
      setPrintErr('Print layout not ready yet.');
      return;
    }
    setPrintErr(null);
    setPrintBusy(true);
    try {
      await printPurchasePdf(el);
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
        Invalid purchase id.
      </div>
    );
  }

  const bill = q.data;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-12">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <Link to="/purchases" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          All purchases
        </Link>
        {bill && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/purchases/${bill.purchaseBillId}/print`}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/35 bg-indigo-950/40 px-4 py-2.5 text-sm font-semibold text-indigo-100 hover:bg-indigo-900/50"
            >
              <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
              Templates &amp; print setup
            </Link>
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
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 hover:bg-emerald-600 disabled:opacity-50"
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

      {printErr ? (
        <div role="alert" className="no-print workspace-panel border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {printErr}
        </div>
      ) : null}

      {q.isLoading && (
        <div className="no-print workspace-panel flex items-center gap-3 px-6 py-12 text-slate-400">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
          Loading purchase…
        </div>
      )}

      {q.isError && (
        <div role="alert" className="no-print workspace-panel border border-rose-500/25 bg-rose-500/10 px-6 py-6 text-sm text-rose-200">
          Purchase not found or you lack access (<span className="font-mono">purchases.read</span>).
        </div>
      )}

      {bill && (
        <>
          {bill.status === 'Draft' && (
            <div className="no-print workspace-panel border border-amber-500/25 bg-amber-500/10 px-6 py-4 text-sm text-amber-100">
              <p className="font-semibold text-amber-50">This bill is a draft</p>
              <p className="mt-1 text-xs text-amber-200/90">
                Inventory is unchanged until you post. Continue editing in the composer or post from here.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to={`/purchases/new?loadDraft=${bill.purchaseBillId}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Continue editing
                </Link>
                <button
                  type="button"
                  disabled={postDraftMut.isPending}
                  onClick={() => postDraftMut.mutate()}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {postDraftMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Post purchase
                </button>
              </div>
              {postDraftError && (
                <p role="alert" className="mt-3 text-xs text-rose-300">
                  {postDraftError}
                </p>
              )}
            </div>
          )}

          <header className="no-print workspace-panel flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                <Truck size={24} aria-hidden />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Purchase bill (supplier)</p>
                <h1 className="text-2xl font-bold text-white">{bill.purchaseNumber ?? `#${bill.purchaseBillId}`}</h1>
                <p className="mt-1 text-sm text-slate-400">
                  <span className="font-medium text-slate-200">{bill.supplierName}</span>
                  <span className="mx-2 text-slate-600">·</span>
                  Party <span className="font-mono text-slate-300">{bill.partyId}</span>
                  <span className="mx-2 text-slate-600">·</span>
                  Received {fmtDate(bill.receivedUtc)}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total payable</p>
              <p className="text-2xl font-bold text-white">{fmtInr(bill.totalAmount)}</p>
              <p className="mt-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">{bill.status}</span>
                <span className="ml-2 font-mono text-xs text-slate-500">{bill.currency}</span>
              </p>
            </div>
          </header>

          <section className="no-print workspace-panel p-6">
            <h2 className="text-lg font-semibold text-white">Lines</h2>
            <p className="mt-1 text-sm text-slate-500">
              Rows with a product reference increased stock by quantity when this bill was posted.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Product</th>
                    <th className="py-2 pr-4 text-right">Qty</th>
                    <th className="py-2 pr-4 text-right">Rate</th>
                    <th className="py-2 pr-4 text-right">Disc %</th>
                    <th className="py-2 pr-4 text-right">Disc ₹</th>
                    <th className="py-2 pr-4 text-right">GST %</th>
                    <th className="py-2 pr-4 text-right">Taxable</th>
                    <th className="py-2 pr-4 text-right">Tax</th>
                    <th className="py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.lines.map((line) => (
                    <tr key={line.purchaseLineId} className="border-b border-white/5">
                      <td className="py-3 pr-4 text-slate-200">{line.description}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">{line.productId ?? '—'}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-400">{line.quantity}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-400">{fmtInr(line.unitCost)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-400">{line.discountPercent}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-400">{fmtInr(line.discountAmount)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-400">{line.taxRatePercent}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-400">{fmtInr(line.taxableAmount)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-400">{fmtInr(line.taxAmount)}</td>
                      <td className="py-3 text-right font-medium tabular-nums text-slate-100">{fmtInr(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="no-print text-center text-xs text-slate-500">
            Printable <span className="font-medium text-slate-400">purchase invoice</span> below lists your organization (
            {organization.name}
            {organization.code ? (
              <>
                {' '}
                · <span className="font-mono text-slate-600">{organization.code}</span>
              </>
            ) : null}
            ) as buyer and the supplier party only — no retail customer.
          </p>

          <div className="invoice-print-root px-0 pb-16">
            <PurchasePrintSurface
              bill={bill}
              organization={organization}
              templateId={printPrefs.templateId}
              options={printPrefs.options}
            />
          </div>
        </>
      )}
    </div>
  );
}
