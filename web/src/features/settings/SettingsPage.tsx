import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutTemplate, Palette, RotateCcw } from 'lucide-react';
import type { OrganizationMembership } from '../../entities/auth-types';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../auth/authSlice';
import { apiJsonAuth } from '../../shared/api/axiosClient';
import { PURCHASE_PRINT_ACCENT_PREVIEW } from '../purchases/purchasePrintAccentPreview';
import { demoPurchaseBillForThemePreview } from '../purchases/purchasePrintDemoBill';
import { PurchasePrintSurface } from '../purchases/PurchasePrintSurface';
import { usePurchasePrintPrefs } from '../purchases/purchasePrintStorage';
import { PURCHASE_PRINT_TEMPLATES } from '../purchases/purchasePrintTemplates';
import type { PurchasePrintOptions } from '../purchases/purchasePrintTypes';
import { ThemeAppearancePicker } from '../../shared/theme/ThemeAppearancePicker';

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.06]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 rounded border-white/20 bg-[#1a1f2e]" />
      <span className="text-sm font-medium text-slate-200">{label}</span>
    </label>
  );
}

export function SettingsPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;

  const { prefs, setTemplateId, patchOptions, resetDefaults } = usePurchasePrintPrefs(workplaceOrgId);
  const o = prefs.options;

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

  const demoBill = useMemo(() => demoPurchaseBillForThemePreview(), []);

  function set<K extends keyof PurchasePrintOptions>(key: K, value: PurchasePrintOptions[K]) {
    patchOptions({ [key]: value } as Partial<PurchasePrintOptions>);
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Workspace defaults stored on this device. Purchase invoice PDFs and previews use the theme and toggles you set here (per organization).
        </p>
      </header>

      <ThemeAppearancePicker />

      {workplaceOrgId <= 0 ? (
        <div role="alert" className="workspace-panel border border-amber-500/25 bg-amber-500/10 px-6 py-5 text-sm text-amber-100">
          Select a workplace from the header badge before changing settings.
        </div>
      ) : (
        <section className="workspace-panel space-y-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                <Palette className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Default purchase invoice theme</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Applies to purchase bill print/PDF and detail-page preview. Fine-tune columns and blocks per bill from{' '}
                  <span className="font-medium text-slate-400">Templates &amp; print setup</span> on any purchase.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => resetDefaults()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset theme defaults
            </button>
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">Saved automatically · this browser only</p>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] lg:items-start">
            <div className="space-y-8">
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <LayoutTemplate className="h-4 w-4 text-slate-400" aria-hidden />
                  Layout template
                </p>
                <div className="flex flex-wrap gap-3">
                  {PURCHASE_PRINT_TEMPLATES.map((t) => {
                    const active = prefs.templateId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplateId(t.id)}
                        className={`flex w-[140px] shrink-0 flex-col rounded-xl border p-3 text-left transition ${
                          active ? 'border-emerald-500/70 bg-emerald-950/35 ring-2 ring-emerald-500/25' : 'border-white/10 bg-white/[0.03] hover:border-white/18'
                        }`}
                      >
                        <span className={`mb-2 h-7 w-full rounded-lg bg-gradient-to-r ${PURCHASE_PRINT_ACCENT_PREVIEW[t.accent]}`} aria-hidden />
                        <span className="text-xs font-semibold text-slate-100">{t.label}</span>
                        <span className="mt-0.5 text-[10px] leading-snug text-slate-500">{t.subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Common print options</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle checked={o.showAmountInWords} onChange={(v) => set('showAmountInWords', v)} label="Amount in words" />
                  <Toggle checked={o.showTotalsSidebar} onChange={(v) => set('showTotalsSidebar', v)} label="Summary sidebar" />
                  <Toggle checked={o.showTaxSummaryByRate} onChange={(v) => set('showTaxSummaryByRate', v)} label="Tax by GST %" />
                  <Toggle checked={o.combinedLineDiscountAndGst} onChange={(v) => set('combinedLineDiscountAndGst', v)} label="Vyapar ₹ + % line cells" />
                  <Toggle checked={o.useSolidRedGstTable} onChange={(v) => set('useSolidRedGstTable', v)} label="Red GST table" />
                  <Toggle checked={o.showHsnColumn} onChange={(v) => set('showHsnColumn', v)} label="HSN/SAC column" />
                  <Toggle checked={o.showLineTaxBreakdown} onChange={(v) => set('showLineTaxBreakdown', v)} label="Taxable & tax columns" />
                  <Toggle checked={o.showLineGstPercent} onChange={(v) => set('showLineGstPercent', v)} label="GST % column" />
                  <Toggle checked={o.showLineDiscountColumns} onChange={(v) => set('showLineDiscountColumns', v)} label="Discount columns" />
                  <Toggle checked={o.showBankPlaceholder} onChange={(v) => set('showBankPlaceholder', v)} label="Bank pay-to block" />
                  <Toggle checked={o.showQrPaymentPlaceholder} onChange={(v) => set('showQrPaymentPlaceholder', v)} label="QR / UPI placeholder" />
                  <Toggle checked={o.showTermsBlock} onChange={(v) => set('showTermsBlock', v)} label="Terms & conditions" />
                  <Toggle checked={o.showSignature} onChange={(v) => set('showSignature', v)} label="Signature line" />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4">
                <p className="text-sm text-slate-400">
                  Open <Link className="font-semibold text-teal-400 hover:text-teal-300" to="/purchases">Purchases</Link>, pick a bill, then use{' '}
                  <strong className="text-slate-300">Templates &amp; print setup</strong> for transport blocks, bank placeholder, buyer GSTIN header,
                  and received/balance lines.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#080c14] p-4">
              <p className="mb-3 text-center text-[11px] uppercase tracking-wide text-slate-500">Preview sample bill</p>
              <div className="invoice-print-root max-h-[min(70vh,880px)] overflow-auto rounded-lg bg-stone-800/35 p-2">
                <div className="flex justify-center">
                  <PurchasePrintSurface bill={demoBill} organization={organization} templateId={prefs.templateId} options={prefs.options} />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
