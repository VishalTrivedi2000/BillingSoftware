import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, LayoutTemplate, Loader2, Printer, RotateCcw } from 'lucide-react';
import type { PurchaseBillDetailDto } from '../../entities/billing';
import type { OrganizationMembership } from '../../entities/auth-types';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import { PurchasePrintSurface } from './PurchasePrintSurface';
import { downloadPurchasePdf, printPurchasePdf, purchasePdfFilename } from './purchasePdf';
import { usePurchasePrintPrefs } from './purchasePrintStorage';
import { PURCHASE_PRINT_TEMPLATES } from './purchasePrintTemplates';
import { PURCHASE_PRINT_ACCENT_PREVIEW } from './purchasePrintAccentPreview';
import type { PurchasePrintOptions } from './purchasePrintTypes';

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.06]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 rounded border-white/20 bg-[#1a1f2e]" />
      <span>
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-slate-500">{hint}</span> : null}
      </span>
    </label>
  );
}

export function PurchasePrintStudioPage() {
  const { purchaseBillId } = useParams<{ purchaseBillId: string }>();
  const id = purchaseBillId ? Number(purchaseBillId) : NaN;
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;

  const { prefs, setTemplateId, patchOptions, resetDefaults } = usePurchasePrintPrefs(workplaceOrgId);
  const o = prefs.options;

  const q = useQuery({
    queryKey: ['purchase-detail-print', id, workplaceOrgId],
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

  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [printErr, setPrintErr] = useState<string | null>(null);

  async function handleDownloadPdf(bill: PurchaseBillDetailDto) {
    const el = document.getElementById('purchase-print-surface');
    if (!el) return;
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
      setPrintErr('Preview not ready.');
      return;
    }
    setPrintErr(null);
    setPrintBusy(true);
    try {
      await printPurchasePdf(el);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not print.';
      setPrintErr(msg.slice(0, 240));
    } finally {
      setPrintBusy(false);
    }
  }

  function set<K extends keyof PurchasePrintOptions>(key: K, value: PurchasePrintOptions[K]) {
    patchOptions({ [key]: value } as Partial<PurchasePrintOptions>);
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
    <div className="mx-auto max-w-[1600px] space-y-6 pb-16">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <Link to={`/purchases/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          Back to purchase
        </Link>
        {bill ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={printBusy}
              onClick={() => void handlePrintPdf()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
            >
              {printBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4 shrink-0" aria-hidden />}
              Print PDF…
            </button>
            <button
              type="button"
              disabled={pdfBusy}
              onClick={() => void handleDownloadPdf(bill)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4 shrink-0" aria-hidden />}
              PDF
            </button>
          </div>
        ) : null}
      </div>

      <header className="no-print space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <LayoutTemplate className="h-7 w-7 text-emerald-400" aria-hidden />
          Print · Purchase invoice
        </h1>
        <p className="max-w-none text-pretty text-sm text-slate-400">
          Controls like Vyapar: toggles on the left, template gallery and live preview on the right. Settings persist per organization in{' '}
          <span className="font-mono text-xs text-slate-500">localStorage</span>.
        </p>
      </header>

      {printErr ? (
        <div role="alert" className="no-print workspace-panel border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {printErr}
        </div>
      ) : null}

      {q.isLoading && (
        <div className="no-print workspace-panel flex items-center gap-3 px-6 py-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" aria-hidden />
          Loading purchase…
        </div>
      )}

      {q.isError && (
        <div role="alert" className="no-print workspace-panel border border-rose-500/25 bg-rose-500/10 px-6 py-6 text-sm text-rose-200">
          Could not load purchase for print preview.
        </div>
      )}

      {bill && (
        <div className="no-print grid gap-8 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] lg:items-start">
          <aside className="workspace-panel space-y-6 p-5">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Regular printer</p>
              <button
                type="button"
                onClick={() => resetDefaults()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/5"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Reset
              </button>
            </div>

            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Totals &amp; tax view</p>
              <Toggle checked={o.showTotalsSidebar} onChange={(v) => set('showTotalsSidebar', v)} label="Summary sidebar (taxable / GST / total)" />
              <Toggle checked={o.showTaxSummaryByRate} onChange={(v) => set('showTaxSummaryByRate', v)} label="Tax summary lines (by GST %)" hint="Shown in sidebar." />
              <Toggle checked={o.showAmountInWords} onChange={(v) => set('showAmountInWords', v)} label="Amount in words (Indian)" />
              <Toggle checked={o.showReceivedAndBalance} onChange={(v) => set('showReceivedAndBalance', v)} label="Received & balance" hint="Uses preview amounts below." />
              <label className="block px-1 pt-1 text-xs text-slate-400">
                Sidebar tax prefix (interstate-style label)
                <select
                  value={o.gstSummaryLinePrefix}
                  onChange={(e) => set('gstSummaryLinePrefix', e.target.value === 'GST' ? 'GST' : 'IGST')}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100"
                >
                  <option value="IGST">IGST @ …%</option>
                  <option value="GST">GST @ …%</option>
                </select>
              </label>
              {o.showReceivedAndBalance ? (
                <label className="block px-1 pt-1 text-xs text-slate-400">
                  Received amount (preview)
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={o.receivedAmount}
                    onChange={(e) => set('receivedAmount', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100"
                  />
                </label>
              ) : null}
              <Toggle checked={o.showPaymentModeLine} onChange={(v) => set('showPaymentModeLine', v)} label="Payment mode line" />
              {o.showPaymentModeLine ? (
                <input
                  value={o.paymentModeLabel}
                  onChange={(e) => set('paymentModeLabel', e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100"
                  placeholder="NEFT / Cheque / Cash"
                />
              ) : null}
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Line table columns</p>
              <Toggle checked={o.showHsnColumn} onChange={(v) => set('showHsnColumn', v)} label="HSN/SAC column" hint="Shows placeholder until item codes exist." />
              <Toggle
                checked={o.combinedLineDiscountAndGst}
                onChange={(v) => set('combinedLineDiscountAndGst', v)}
                label="Vyapar-style ₹ + % cells"
                hint="Single Discount and GST columns (recommended)."
              />
              <Toggle checked={o.useSolidRedGstTable} onChange={(v) => set('useSolidRedGstTable', v)} label="Red GST table bands" />
              <Toggle checked={o.showTotalItemQuantity} onChange={(v) => set('showTotalItemQuantity', v)} label="Qty sum in table footer" />
              <Toggle checked={o.showLineDiscountColumns} onChange={(v) => set('showLineDiscountColumns', v)} label="Discount columns" />
              <Toggle checked={o.showLineGstPercent} onChange={(v) => set('showLineGstPercent', v)} label="GST %" />
              <Toggle checked={o.showLineTaxBreakdown} onChange={(v) => set('showLineTaxBreakdown', v)} label="Taxable & tax columns (legacy)" hint="Turn off with combined layout." />
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Optional blocks</p>
              <Toggle checked={o.showTransportBlock} onChange={(v) => set('showTransportBlock', v)} label="Transport / vehicle / delivery" />
              <Toggle checked={o.showBankPlaceholder} onChange={(v) => set('showBankPlaceholder', v)} label="Bank pay-to placeholder" />
              <Toggle checked={o.showQrPaymentPlaceholder} onChange={(v) => set('showQrPaymentPlaceholder', v)} label="QR / UPI placeholder box" />
              <Toggle checked={o.showTermsBlock} onChange={(v) => set('showTermsBlock', v)} label="Terms & conditions" />
              <Toggle checked={o.showFooterDescription} onChange={(v) => set('showFooterDescription', v)} label="Footer description" />
              <Toggle checked={o.showSignature} onChange={(v) => set('showSignature', v)} label="Signature line" />
              {o.showSignature ? (
                <input
                  value={o.signatureLabel}
                  onChange={(e) => set('signatureLabel', e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100"
                />
              ) : null}
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Buyer header (printed)</p>
              <input
                value={o.orgGstinPlaceholder}
                onChange={(e) => set('orgGstinPlaceholder', e.target.value)}
                placeholder="Your GSTIN"
                className="w-full rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
              />
              <textarea
                value={o.orgAddressPlaceholder}
                onChange={(e) => set('orgAddressPlaceholder', e.target.value)}
                placeholder="Your registered address"
                rows={2}
                className="w-full resize-y rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
              />
              <input
                value={o.orgPhonePlaceholder}
                onChange={(e) => set('orgPhonePlaceholder', e.target.value)}
                placeholder="Phone / email"
                className="w-full rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
              />
            </section>

            <section>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Terms text</label>
              <textarea
                value={o.termsText}
                onChange={(e) => set('termsText', e.target.value)}
                rows={5}
                className="mt-2 w-full resize-y rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100"
              />
            </section>

            <section>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Footer description</label>
              <textarea
                value={o.footerDescription}
                onChange={(e) => set('footerDescription', e.target.value)}
                rows={3}
                className="mt-2 w-full resize-y rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100"
              />
            </section>
          </aside>

          <div className="space-y-4 lg:sticky lg:top-4">
            <div className="rounded-xl border border-white/10 bg-[#0d121c]/95 p-4 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400/90">Templates</p>
              <p className="mt-1 text-[11px] text-slate-500">Select a layout — preview updates instantly.</p>
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
                {PURCHASE_PRINT_TEMPLATES.map((t) => {
                  const active = prefs.templateId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      className={`flex w-[148px] shrink-0 flex-col rounded-xl border p-3 text-left transition ${
                        active ? 'border-emerald-500/70 bg-emerald-950/40 ring-2 ring-emerald-500/30' : 'border-white/10 bg-white/[0.04] hover:border-white/20'
                      }`}
                    >
                      <span className={`mb-2 h-8 w-full rounded-lg bg-gradient-to-r ${PURCHASE_PRINT_ACCENT_PREVIEW[t.accent]}`} aria-hidden />
                      <span className="text-xs font-semibold text-white">{t.label}</span>
                      <span className="mt-0.5 text-[10px] leading-snug text-slate-500">{t.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#080c14] p-4">
              <p className="mb-4 text-center text-[11px] uppercase tracking-wide text-slate-500">Live preview · A4</p>
              <div className="invoice-print-root max-h-[min(85vh,1200px)] overflow-auto rounded-lg bg-stone-800/40 p-3">
                <div className="flex justify-center">
                  <PurchasePrintSurface bill={bill} organization={organization} templateId={prefs.templateId} options={prefs.options} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
