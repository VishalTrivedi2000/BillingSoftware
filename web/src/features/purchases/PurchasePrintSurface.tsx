import type { CSSProperties } from 'react';
import type { PurchaseBillDetailDto } from '../../entities/billing';
import type { InvoiceOrgBranding } from '../invoices/InvoiceDocument';
import { inrAmountToWords } from '../invoices/inrAmountWords';
import type { PurchasePrintOptions } from './purchasePrintTypes';
import { ACCENT_TABLE_HEAD_CSS, ACCENT_TOP_BAND_CSS, purchaseStatusChipStyle } from './purchasePrintPaintTokens';
import { getPurchasePrintTemplate } from './purchasePrintTemplates';

export type PurchasePrintSurfaceProps = {
  bill: PurchaseBillDetailDto;
  organization: InvoiceOrgBranding;
  templateId: string;
  options: PurchasePrintOptions;
};

const SERIF = "'Playfair Display', Georgia, serif";
const SANS = "'DM Sans', ui-sans-serif, system-ui, sans-serif";

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

function fmtReceivedDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function taxBuckets(lines: PurchaseBillDetailDto['lines']) {
  const m = new Map<number, { taxable: number; tax: number }>();
  for (const l of lines) {
    const k = Math.round(l.taxRatePercent * 100) / 100;
    const e = m.get(k) ?? { taxable: 0, tax: 0 };
    e.taxable += l.taxableAmount;
    e.tax += l.taxAmount;
    m.set(k, e);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function PurchasePrintSurface(props: PurchasePrintSurfaceProps) {
  const { bill, organization: org, templateId, options: o } = props;
  const meta = getPurchasePrintTemplate(templateId);
  const { accent, preset } = meta;
  const themeSkin = meta.themeSkin ?? 'standard';
  const customSkinBlocksStripe = themeSkin === 'purple-french' || themeSkin === 'double-divine' || themeSkin === 'sale-purple';
  const showDefaultVyBar = !customSkinBlocksStripe && (preset === 'vyapar' || preset === 'slateHeader');
  const showTopAccentStripe = !customSkinBlocksStripe && !showDefaultVyBar;
  const skipClassicHeader = themeSkin === 'sale-purple';
  const bandHeader =
    themeSkin === 'purple-french' ||
    themeSkin === 'double-divine' ||
    (themeSkin === 'standard' && (preset === 'vyapar' || preset === 'slateHeader'));

  const label = bill.purchaseNumber ?? `PUR-${bill.purchaseBillId}`;
  const isDraft = bill.status.trim().toLowerCase() === 'draft';
  const words =
    o.showAmountInWords && bill.currency.trim().toUpperCase() === 'INR' ? inrAmountToWords(bill.totalAmount) : null;

  const linesSum = bill.lines.reduce((acc, l) => acc + l.lineTotal, 0);
  const totalsAligned = Math.abs(round2(linesSum) - round2(bill.totalAmount)) < 0.005;
  const sumTaxable = round2(bill.lines.reduce((a, l) => a + l.taxableAmount, 0));
  const sumTax = round2(bill.lines.reduce((a, l) => a + l.taxAmount, 0));
  const sumDiscount = round2(bill.lines.reduce((a, l) => a + l.discountAmount, 0));
  const sumQty = round2(bill.lines.reduce((a, l) => a + l.quantity, 0));
  const buckets = taxBuckets(bill.lines);
  const received = Math.max(0, o.receivedAmount);
  const balance = Math.max(0, round2(bill.totalAmount - received));

  const combined = o.combinedLineDiscountAndGst;
  const showDisc = o.showLineDiscountColumns;
  const showGstCombined = combined && (o.showLineGstPercent || o.showLineTaxBreakdown);
  const showGstLegacy = !combined && o.showLineGstPercent;
  const showTaxCols = !combined && o.showLineTaxBreakdown;
  const vyaparTableBands = o.useSolidRedGstTable && preset !== 'thermal';

  const colBeforeAmount =
    5 +
    (combined && showDisc ? 1 : 0) +
    (!combined && showDisc ? 2 : 0) +
    (combined && showGstCombined ? 1 : 0) +
    (showGstLegacy ? 1 : 0) +
    (showTaxCols ? 2 : 0);

  const pad =
    preset === 'compact' || preset === 'thermal'
      ? 'px-4 py-6 sm:px-5 sm:py-8'
      : preset === 'minimal'
        ? 'px-6 py-8 sm:px-8'
        : 'px-7 pb-11 pt-10 sm:px-11 sm:pb-14 sm:pt-12';
  const cell =
    preset === 'thermal' ? 'px-1.5 py-1.5 text-[9px]' : preset === 'compact' ? 'px-2 py-2 text-[10px]' : 'px-2 py-3 text-[11px] sm:text-[13px]';

  const gstSolidBandHex =
    vyaparTableBands && (themeSkin === 'purple-french' || themeSkin === 'sale-purple')
      ? '#7c3aed'
      : vyaparTableBands
        ? '#b91c1c'
        : null;

  const theadRowStyle: CSSProperties | undefined = vyaparTableBands
    ? { backgroundColor: gstSolidBandHex ?? '#b91c1c', color: '#ffffff' }
    : { backgroundImage: ACCENT_TABLE_HEAD_CSS[accent], color: '#ffffff' };

  const tfootBandHex = themeSkin === 'purple-french' || themeSkin === 'sale-purple' ? '#6d28d9' : '#b91c1c';
  const sidebarTotalHex = themeSkin === 'purple-french' || themeSkin === 'sale-purple' ? '#6d28d9' : vyaparTableBands ? '#b91c1c' : '#b91c1c';

  const sidebar =
    o.showTotalsSidebar && (
      <div className="w-full shrink-0 rounded-xl border border-stone-200 bg-white p-4 text-[11px] shadow-sm lg:max-w-[14rem]">
        <p className="font-bold uppercase tracking-wide text-stone-600">Summary</p>
        <dl className="mt-3 space-y-2">
          <div className="flex justify-between gap-2">
            <dt className="text-stone-500">Sub total</dt>
            <dd className="font-mono font-semibold text-stone-900">{fmtInr(sumTaxable)}</dd>
          </div>
          {sumDiscount > 0.004 && showDisc ? (
            <div className="flex justify-between gap-2">
              <dt className="text-stone-500">Discount</dt>
              <dd className="font-mono font-semibold text-stone-900">−{fmtInr(sumDiscount)}</dd>
            </div>
          ) : null}
          {o.showTaxSummaryByRate && buckets.length > 0
            ? buckets.map(([rate, v]) => (
                <div key={rate} className="flex justify-between gap-2">
                  <dt className="max-w-[58%] text-stone-500">
                    {o.gstSummaryLinePrefix} @ {rate}%
                  </dt>
                  <dd className="font-mono font-semibold text-stone-900">{fmtInr(round2(v.tax))}</dd>
                </div>
              ))
            : (
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500">Total GST</dt>
                  <dd className="font-mono font-semibold text-stone-900">{fmtInr(sumTax)}</dd>
                </div>
              )}
          <div className="flex justify-between gap-2 border-t border-stone-100 pt-2">
            <dt className="font-semibold text-stone-800">Total</dt>
            <dd className="font-mono font-bold" style={{ color: sidebarTotalHex }}>
              {fmtInr(bill.totalAmount)}
            </dd>
          </div>
          {o.showReceivedAndBalance ? (
            <>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-500">Received</dt>
                <dd className="font-mono text-stone-800">{fmtInr(received)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-500">Balance</dt>
                <dd className="font-mono font-semibold text-amber-900">{fmtInr(balance)}</dd>
              </div>
            </>
          ) : null}
          {o.showPaymentModeLine ? (
            <div className="border-t border-stone-100 pt-2">
              <p className="text-[10px] text-stone-500">Payment mode</p>
              <p className="font-medium text-stone-800">{o.paymentModeLabel}</p>
            </div>
          ) : null}
        </dl>
      </div>
    );

  const taxSummary =
    o.showTaxSummaryByRate && buckets.length > 0 && !o.showTotalsSidebar ? (
      <div className="mt-4 rounded-lg border border-stone-200 p-4 text-[11px]" style={{ backgroundColor: 'rgba(245, 245, 244, 0.92)' }}>
        <p className="font-bold uppercase tracking-wide text-stone-700">Tax detail (by rate)</p>
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="text-left text-[10px] text-stone-500">
              <th className="py-1">GST %</th>
              <th className="py-1 text-right">Taxable</th>
              <th className="py-1 text-right">Tax</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map(([rate, v]) => (
              <tr key={rate} className="border-t border-stone-200">
                <td className="py-1.5 font-mono">{rate}%</td>
                <td className="py-1.5 text-right font-mono">{fmtInr(round2(v.taxable))}</td>
                <td className="py-1.5 text-right font-mono">{fmtInr(round2(v.tax))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null;

  const transport = o.showTransportBlock ? (
    <div
      className="mt-4 grid gap-2 rounded-lg border border-dashed border-stone-300 p-4 text-[11px] text-stone-700 sm:grid-cols-3"
      style={{ backgroundColor: 'rgba(255,255,255,0.82)' }}
    >
      <div>
        <span className="font-semibold text-stone-500">Transport</span>
        <p className="mt-1 text-stone-400">—</p>
      </div>
      <div>
        <span className="font-semibold text-stone-500">Vehicle no.</span>
        <p className="mt-1 text-stone-400">—</p>
      </div>
      <div>
        <span className="font-semibold text-stone-500">Delivery date</span>
        <p className="mt-1 text-stone-400">—</p>
      </div>
    </div>
  ) : null;

  const bank = o.showBankPlaceholder ? (
    <div className="rounded-lg border border-stone-200 bg-white p-4 text-[11px] text-stone-700">
      <div className={`flex flex-wrap gap-4 ${o.showQrPaymentPlaceholder ? 'sm:flex-nowrap' : ''}`}>
        {o.showQrPaymentPlaceholder ? (
          <div
            className="flex h-[104px] w-[104px] shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 text-center text-[10px] font-semibold uppercase tracking-wide text-stone-500"
            aria-hidden
          >
            QR / UPI
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-bold uppercase tracking-wide text-stone-600">Pay to</p>
          <p className="mt-2 leading-relaxed text-stone-600">
            <span className="font-semibold text-stone-700">Bank name</span> · Branch · A/C · IFSC
          </p>
          <p
            className="mt-2 rounded-md px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: '#ecfdf5',
              color: '#065f46',
              border: '1px solid rgba(4, 120, 87, 0.35)',
            }}
          >
            UPI pay (configure account details)
          </p>
        </div>
      </div>
    </div>
  ) : null;

  const frenchBanner =
    themeSkin === 'purple-french' ? (
      <>
        <div
          style={{
            backgroundColor: '#6d28d9',
            color: '#ffffff',
            padding: '12px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 800, letterSpacing: '0.22em', fontSize: 11 }}>PURCHASE BILL</span>
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{label}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            padding: '16px 22px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e7e5e4',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: '#111827' }}>{org.name}</div>
            {(o.orgGstinPlaceholder || o.orgAddressPlaceholder || o.orgPhonePlaceholder) ? (
              <p style={{ marginTop: 8, fontSize: 11, color: '#57534e', lineHeight: 1.5 }}>
                {o.orgGstinPlaceholder ? <span>GSTIN {o.orgGstinPlaceholder} · </span> : null}
                {o.orgAddressPlaceholder}
                {o.orgPhonePlaceholder ? <span> · {o.orgPhonePlaceholder}</span> : null}
              </p>
            ) : null}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: '#6d28d9' }}>Purchase bill</div>
            <p style={{ marginTop: 8, fontSize: 11, color: '#57534e' }}>Received</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#111827' }}>{fmtReceivedDate(bill.receivedUtc)}</p>
          </div>
        </div>
      </>
    ) : null;

  const doubleBanner =
    themeSkin === 'double-divine' ? (
      <>
        <div style={{ height: 4, backgroundColor: '#dc2626' }} />
        <div style={{ display: 'flex', minHeight: 92, backgroundColor: '#fafaf9' }}>
          <div
            style={{
              flex: 1,
              backgroundColor: '#111827',
              color: '#ffffff',
              padding: '18px 26px',
              clipPath: 'ellipse(115% 125% at 0% 48%)',
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.78)' }}>Purchase · Buyer</p>
            <p style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, marginTop: 6, lineHeight: 1.2 }}>{org.name}</p>
            {(o.orgGstinPlaceholder || o.orgAddressPlaceholder || o.orgPhonePlaceholder) ? (
              <p style={{ marginTop: 10, fontSize: 10, lineHeight: 1.45, color: 'rgba(255,255,255,0.88)' }}>
                {o.orgGstinPlaceholder ? <>GSTIN {o.orgGstinPlaceholder} · </> : null}
                {o.orgAddressPlaceholder}
                {o.orgPhonePlaceholder ? <> · {o.orgPhonePlaceholder}</> : null}
              </p>
            ) : null}
          </div>
          <div
            style={{
              flex: '0 0 44%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-end',
              padding: '18px 22px',
              textAlign: 'right',
            }}
          >
            <p style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: '#111827', margin: 0 }}>Purchase bill</p>
            <p style={{ marginTop: 10, fontSize: 11, color: '#57534e' }}>Bill No.</p>
            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{label}</p>
          </div>
        </div>
      </>
    ) : null;

  const vyBar =
    showDefaultVyBar ? (
      <div
        style={{
          display: 'flex',
          minHeight: '3.25rem',
          alignItems: 'stretch',
          backgroundImage:
            preset === 'slateHeader'
              ? 'linear-gradient(90deg, #0f172a 0%, #020617 100%)'
              : ACCENT_TOP_BAND_CSS[accent],
        }}
      >
        <div className="flex flex-1 flex-col justify-center px-5 py-3 sm:px-8">
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.78)' }}>
            Purchase · Buyer
          </p>
          <p className="text-lg font-bold leading-tight sm:text-xl" style={{ fontFamily: SERIF, color: '#ffffff' }}>
            {org.name}
          </p>
          {(o.orgGstinPlaceholder || o.orgAddressPlaceholder || o.orgPhonePlaceholder) ? (
            <p style={{ marginTop: 4, maxWidth: 576, fontSize: 10, lineHeight: 1.5, color: 'rgba(255,255,255,0.88)' }}>
              {o.orgGstinPlaceholder ? <>GSTIN {o.orgGstinPlaceholder} · </> : null}
              {o.orgAddressPlaceholder}
              {o.orgPhonePlaceholder ? <> · {o.orgPhonePlaceholder}</> : null}
            </p>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '12px 22px',
            textAlign: 'right',
            color: 'rgba(255,255,255,0.95)',
            backgroundColor: 'rgba(0,0,0,0.22)',
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Purchase bill</p>
          <p className="mt-1 font-mono text-sm font-semibold text-white">{label}</p>
        </div>
      </div>
    ) : null;

  const shell =
    preset === 'minimal'
      ? 'border border-[#a8a29e] bg-white shadow-sm'
      : preset === 'ledger'
        ? 'border-2 border-double border-[#78716c] bg-[#fffef8]'
        : 'border border-[#d6d3d1] bg-[#fbfaf9] shadow-[0_28px_90px_-24px_rgba(28,25,23,0.28)]';

  return (
    <div
      id="purchase-print-surface"
      className={`invoice-print-surface relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-xl text-[#1c1917] print:max-w-none print:rounded-none print:border-0 print:shadow-none ${shell}`}
      style={{ fontFamily: SANS }}
    >
      {frenchBanner}
      {doubleBanner}
      {vyBar}

      {showTopAccentStripe ? (
        <div className="flex h-1.5 w-full">
          <div className="h-full flex-[6]" style={{ backgroundImage: ACCENT_TOP_BAND_CSS[accent] }} />
          <div className="h-full flex-1" style={{ backgroundColor: '#292524' }} />
        </div>
      ) : null}

      {isDraft ? (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rotate-[-16deg] select-none text-[clamp(2.5rem,12vw,7rem)] font-black uppercase tracking-widest"
          style={{ color: 'rgba(28, 25, 23, 0.055)' }}
          aria-hidden
        >
          Draft
        </div>
      ) : null}

      <div className={`relative ${pad}`}>
        {themeSkin === 'sale-purple' ? (
          <div style={{ marginBottom: 28 }}>
            <h2
              style={{
                textAlign: 'center',
                color: '#6d28d9',
                fontFamily: SERIF,
                fontSize: 28,
                fontWeight: 700,
                margin: 0,
              }}
            >
              Purchase
            </h2>
            <div
              style={{
                marginTop: 20,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <div style={{ border: '1px solid #e7e5e4', borderRadius: 12, padding: 16, backgroundColor: '#ffffff' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#78716c' }}>BILL TO</p>
                <p style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: '#111827', marginTop: 8 }}>{bill.supplierName}</p>
                <p style={{ fontSize: 11, color: '#57534e', marginTop: 8 }}>
                  Party ID <span style={{ fontFamily: 'monospace' }}>{bill.partyId}</span>
                </p>
              </div>
              <div style={{ border: '1px dashed #d6d3d1', borderRadius: 12, padding: 16, backgroundColor: '#fafaf9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#78716c' }}>SHIP TO</p>
                <p style={{ fontSize: 12, color: '#a8a29e', marginTop: 8 }}>—</p>
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                fontSize: 11,
                color: '#57534e',
              }}
            >
              <span>
                Bill <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#111827' }}>{label}</span>
              </span>
              <span>Received {fmtReceivedDate(bill.receivedUtc)}</span>
              <span style={purchaseStatusChipStyle(bill.status)}>{bill.status}</span>
            </div>
          </div>
        ) : null}

        {!bandHeader && !skipClassicHeader ? (
          <header className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="min-w-0 space-y-6">
              <div className={`relative pl-4 sm:pl-5 ${preset === 'ledger' ? 'border-l-4 border-amber-800' : 'border-l-[3px] border-emerald-800'}`}>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-stone-500">Received into · Buyer</p>
                <h2 className="mt-1 max-w-xl text-[1.45rem] font-semibold leading-tight text-[#0f172a] sm:text-[1.75rem]" style={{ fontFamily: SERIF }}>
                  {org.name}
                </h2>
                {org.code ? (
                  <p className="mt-2 inline-flex gap-2 rounded-md bg-white px-2 py-1 font-mono text-[10px] text-stone-600 ring-1 ring-stone-200">
                    ORG {org.code}
                  </p>
                ) : null}
                {(o.orgGstinPlaceholder || o.orgAddressPlaceholder || o.orgPhonePlaceholder) && (
                  <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-stone-600">
                    {o.orgGstinPlaceholder ? <span className="font-semibold">GSTIN {o.orgGstinPlaceholder}</span> : null}
                    {o.orgAddressPlaceholder ? <span className="block">{o.orgAddressPlaceholder}</span> : null}
                    {o.orgPhonePlaceholder ? <span>{o.orgPhonePlaceholder}</span> : null}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-stone-500">Supplier (party)</p>
                  <p className="mt-2 text-base font-semibold text-[#0f172a]" style={{ fontFamily: SERIF }}>
                    {bill.supplierName}
                  </p>
                  <p className="mt-2 border-t border-stone-100 pt-2 text-[11px] text-stone-600">
                    Party ID <span className="font-mono font-medium">{bill.partyId}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-dashed border-stone-300 p-4 text-[11px] text-stone-600" style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}>
                  <p className="font-semibold uppercase text-stone-700">Document</p>
                  <p className="mt-2">
                    Bill <span className="font-mono font-semibold text-stone-900">{label}</span>
                  </p>
                  <p className="mt-2 border-t border-stone-100 pt-2">Received {fmtReceivedDate(bill.receivedUtc)}</p>
                  <span style={purchaseStatusChipStyle(bill.status)} className="mt-3 inline-flex">
                    {bill.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-4 lg:items-end">
              {!o.showTotalsSidebar ? (
                <div className="w-full max-w-[17rem] rounded-xl border border-stone-200 bg-white p-5 shadow-md">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-stone-500">Total payable</p>
                  <p className="mt-2 font-mono text-2xl font-bold text-[#0f172a]">{fmtInr(bill.totalAmount)}</p>
                  {words ? <p className="mt-3 border-t border-stone-100 pt-3 text-[11px] leading-snug text-stone-600">{words}</p> : null}
                </div>
              ) : null}
              {sidebar}
            </div>
          </header>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-stone-500">Supplier (party)</p>
              <p className="mt-2 text-lg font-semibold text-[#0f172a]" style={{ fontFamily: SERIF }}>
                {bill.supplierName}
              </p>
              <p className="mt-2 text-[11px] text-stone-600">
                Party ID <span className="font-mono">{bill.partyId}</span>
              </p>
            </div>
            <div className="flex flex-col gap-4 lg:items-end">
              <div className="w-full max-w-[17rem] rounded-xl border border-stone-200 bg-white p-5 text-right shadow-md">
                <p className="text-[0.62rem] font-semibold uppercase text-stone-500">Bill No.</p>
                <p className="mt-1 font-mono text-lg font-bold">{label}</p>
                <p className="mt-3 text-[11px] text-stone-600">Received</p>
                <p className="font-medium text-stone-900">{fmtReceivedDate(bill.receivedUtc)}</p>
                <span style={purchaseStatusChipStyle(bill.status)} className="mt-3 inline-flex">
                  {bill.status}
                </span>
              </div>
              {sidebar}
            </div>
          </div>
        )}

        {transport}

        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-stone-800">Items</h3>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-600">
              {bill.lines.length} row{bill.lines.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr
                    className="text-[0.58rem] font-bold uppercase tracking-[0.08em] sm:text-[0.62rem]"
                    style={theadRowStyle}
                  >
                    <th className={`${cell} w-8 text-center`}>#</th>
                    <th className={`${cell} min-w-[120px]`}>{combined ? 'Item name' : 'Description'}</th>
                    <th className={`${cell} font-semibold`}>{o.showHsnColumn ? 'HSN/SAC' : 'Ref'}</th>
                    <th className={`${cell} text-right tabular-nums`}>Qty</th>
                    <th className={`${cell} text-right tabular-nums`}>{combined ? 'Price / unit' : 'Rate'}</th>
                    {combined && showDisc ? <th className={`${cell} text-right tabular-nums`}>Discount</th> : null}
                    {!combined && showDisc ? (
                      <>
                        <th className={`${cell} text-right tabular-nums`}>Disc%</th>
                        <th className={`${cell} text-right tabular-nums`}>Disc ₹</th>
                      </>
                    ) : null}
                    {combined && showGstCombined ? <th className={`${cell} text-right tabular-nums`}>GST</th> : null}
                    {showGstLegacy ? <th className={`${cell} text-right tabular-nums`}>GST%</th> : null}
                    {showTaxCols ? (
                      <>
                        <th className={`${cell} text-right tabular-nums`}>Taxable</th>
                        <th className={`${cell} text-right tabular-nums`}>Tax</th>
                      </>
                    ) : null}
                    <th
                      className={`${cell} border-l text-right tabular-nums`}
                      style={{
                        borderLeftColor: vyaparTableBands ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.15)',
                        backgroundColor: vyaparTableBands ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.1)',
                      }}
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bill.lines.map((line, idx) => (
                    <tr
                      key={line.purchaseLineId}
                      className="border-b border-stone-100"
                      style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafaf9' }}
                    >
                      <td className={`${cell} text-center font-mono text-stone-400`}>{idx + 1}</td>
                      <td className={`${cell} font-medium text-stone-900`}>{line.description}</td>
                      <td className={`${cell} font-mono text-stone-500`}>
                        {o.showHsnColumn ? '—' : line.productId != null ? `#${line.productId}` : '—'}
                      </td>
                      <td className={`${cell} text-right tabular-nums text-stone-700`}>{line.quantity}</td>
                      <td className={`${cell} text-right tabular-nums text-stone-700`}>{fmtInr(line.unitCost)}</td>
                      {combined && showDisc ? (
                        <td className={`${cell} text-right tabular-nums text-stone-700`}>
                          <span className="block font-medium">{fmtInr(line.discountAmount)}</span>
                          <span className="text-[10px] text-stone-500">({line.discountPercent}%)</span>
                        </td>
                      ) : null}
                      {!combined && showDisc ? (
                        <>
                          <td className={`${cell} text-right tabular-nums text-stone-600`}>{line.discountPercent}</td>
                          <td className={`${cell} text-right tabular-nums text-stone-600`}>{fmtInr(line.discountAmount)}</td>
                        </>
                      ) : null}
                      {combined && showGstCombined ? (
                        <td className={`${cell} text-right tabular-nums text-stone-700`}>
                          <span className="block font-medium">{fmtInr(line.taxAmount)}</span>
                          <span className="text-[10px] text-stone-500">({line.taxRatePercent}%)</span>
                        </td>
                      ) : null}
                      {showGstLegacy ? <td className={`${cell} text-right tabular-nums text-stone-600`}>{line.taxRatePercent}</td> : null}
                      {showTaxCols ? (
                        <>
                          <td className={`${cell} text-right tabular-nums text-stone-600`}>{fmtInr(line.taxableAmount)}</td>
                          <td className={`${cell} text-right tabular-nums text-stone-600`}>{fmtInr(line.taxAmount)}</td>
                        </>
                      ) : null}
                      <td
                        className={`${cell} border-l border-stone-200 text-right font-semibold tabular-nums text-[#0f172a]`}
                        style={{ backgroundColor: vyaparTableBands ? '#ffffff' : '#fafaf9' }}
                      >
                        {fmtInr(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {vyaparTableBands && combined ? (
                    <tr style={{ backgroundColor: tfootBandHex, color: '#ffffff' }}>
                      <td className={`${cell} font-bold uppercase tracking-wide`} colSpan={3}>
                        Total
                      </td>
                      <td className={`${cell} text-right font-mono font-bold tabular-nums`}>
                        {o.showTotalItemQuantity ? sumQty : ''}
                      </td>
                      <td className={`${cell}`} />
                      {combined && showDisc ? (
                        <td className={`${cell} text-right font-mono font-semibold tabular-nums`}>{fmtInr(sumDiscount)}</td>
                      ) : null}
                      {!combined && showDisc ? (
                        <>
                          <td className={`${cell}`} />
                          <td className={`${cell} text-right font-mono font-semibold tabular-nums`}>{fmtInr(sumDiscount)}</td>
                        </>
                      ) : null}
                      {combined && showGstCombined ? (
                        <td className={`${cell} text-right font-mono font-semibold tabular-nums`}>{fmtInr(sumTax)}</td>
                      ) : null}
                      {showGstLegacy ? <td className={`${cell}`} /> : null}
                      {showTaxCols ? (
                        <>
                          <td className={`${cell} text-right font-mono font-semibold tabular-nums`}>{fmtInr(sumTaxable)}</td>
                          <td className={`${cell} text-right font-mono font-semibold tabular-nums`}>{fmtInr(sumTax)}</td>
                        </>
                      ) : null}
                      <td
                        className={`${cell} border-l text-right font-mono text-base font-bold tabular-nums text-white`}
                        style={{
                          borderLeftColor: 'rgba(255,255,255,0.22)',
                          backgroundColor: 'rgba(0,0,0,0.12)',
                        }}
                      >
                        {fmtInr(bill.totalAmount)}
                      </td>
                    </tr>
                  ) : (
                    <tr style={{ borderTop: '2px solid #d6d3d1', backgroundColor: '#f5f5f4' }}>
                      <td className={`${cell}`} colSpan={colBeforeAmount}>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase text-stone-600">Total · {bill.currency}</p>
                          {!totalsAligned ? <p className="mt-1 text-[10px] text-amber-800">Use header total.</p> : null}
                        </div>
                      </td>
                      <td className={`${cell} border-l border-stone-300 bg-white text-right font-mono text-base font-bold text-[#0f172a]`}>
                        {fmtInr(bill.totalAmount)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {taxSummary}

        {bandHeader && words ? (
          <p className="mt-6 text-[12px] leading-relaxed text-stone-800">
            <span className="font-semibold">Amount in words · </span>
            {words}
          </p>
        ) : null}

        <div className="mt-8 space-y-4">
          {bank}
          {o.showTermsBlock ? (
            <div className="rounded-lg border border-stone-200 p-4 text-[11px] leading-relaxed text-stone-700" style={{ backgroundColor: 'rgba(250, 250, 249, 0.65)' }}>
              <p className="font-bold uppercase tracking-wide text-stone-600">Terms &amp; conditions</p>
              <p className="mt-2 whitespace-pre-wrap">{o.termsText}</p>
            </div>
          ) : null}
          {o.showFooterDescription ? <p className="text-[12px] leading-relaxed text-stone-600">{o.footerDescription}</p> : null}
          {o.showSignature ? (
            <div className="pt-8">
              <div className="h-px max-w-[200px] bg-stone-400" />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">{o.signatureLabel}</p>
            </div>
          ) : null}
        </div>

        {!bandHeader && o.showTotalsSidebar && words ? (
          <p className="mt-6 rounded-lg border border-stone-200 bg-white px-4 py-3 text-[12px] text-stone-800">
            <span className="font-semibold text-stone-600">Amount in words · </span>
            {words}
          </p>
        ) : null}

        <footer className="mt-10 border-t border-stone-200 pt-6 text-[11px] text-stone-500">
          Generated from billing workspace · {label} · Party {bill.partyId}
        </footer>
      </div>

      {showTopAccentStripe ? (
        <div className="flex h-1 w-full">
          <div className="h-full flex-1" style={{ backgroundColor: '#292524' }} />
          <div className="h-full flex-[6]" style={{ backgroundImage: ACCENT_TOP_BAND_CSS[accent] }} />
        </div>
      ) : null}
    </div>
  );
}
