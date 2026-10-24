import type { InvoiceDetailDto } from '../../entities/billing';
import { inrAmountToWords } from './inrAmountWords';

export type InvoiceOrgBranding = {
  name: string;
  code: string;
};

export type InvoiceDocumentProps = {
  invoice: InvoiceDetailDto;
  organization: InvoiceOrgBranding;
};

const SERIF = "'Playfair Display', Georgia, serif";
const SANS = "'DM Sans', ui-sans-serif, system-ui, sans-serif";

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

function fmtIssueDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusChipClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s.includes('paid') || s.includes('settled')) {
    return 'bg-emerald-500/[0.12] text-emerald-900 ring-emerald-600/25';
  }
  if (s.includes('draft') || s.includes('pending')) {
    return 'bg-amber-500/[0.12] text-amber-950 ring-amber-600/25';
  }
  if (s.includes('void') || s.includes('cancel')) {
    return 'bg-rose-500/[0.12] text-rose-950 ring-rose-500/25';
  }
  return 'bg-slate-500/[0.1] text-slate-800 ring-slate-400/20';
}

function SectionOrnament() {
  return (
    <div className="my-12 flex items-center justify-center gap-4 sm:gap-6" aria-hidden>
      <div className="h-px max-w-[120px] flex-1 bg-gradient-to-r from-transparent via-stone-300 to-stone-200" />
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-stone-400">
        <span className="text-[#c9a227]">◆</span>
        <span>Breakdown</span>
        <span className="text-[#c9a227]">◆</span>
      </div>
      <div className="h-px max-w-[120px] flex-1 bg-gradient-to-l from-transparent via-stone-300 to-stone-200" />
    </div>
  );
}

function MetaCardCorners() {
  return (
    <>
      <span className="pointer-events-none absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-[#c9a227]/50" aria-hidden />
      <span className="pointer-events-none absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-[#c9a227]/50" aria-hidden />
      <span className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-stone-300/80" aria-hidden />
      <span className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-stone-300/80" aria-hidden />
    </>
  );
}

function VerifiedSeal() {
  return (
    <svg
      className="shrink-0 text-[#1e3a5f]/90"
      width={72}
      height={72}
      viewBox="0 0 72 72"
      role="img"
      aria-label="Verified totals"
    >
      <circle cx={36} cy={36} r={34} fill="none" stroke="currentColor" strokeWidth={1.25} opacity={0.35} />
      <circle cx={36} cy={36} r={28} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <circle cx={36} cy={36} r={22} fill="rgba(30, 58, 95, 0.05)" stroke="currentColor" strokeWidth={0.75} opacity={0.65} />
      <path
        d="M26 37l6 6 14-16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Print/PDF-friendly invoice layout (light theme). Render once; use id for PDF capture and print CSS.
 */
export function InvoiceDocument(props: InvoiceDocumentProps) {
  const { invoice: inv, organization: org } = props;
  const label = inv.invoiceNumber ?? `INV-${inv.invoiceId}`;
  const amountWords =
    inv.currency.trim().toUpperCase() === 'INR' ? inrAmountToWords(inv.totalAmount) : null;

  const linesSum = inv.lines.reduce((acc, l) => acc + l.lineTotal, 0);
  const roundedSum = Math.round(linesSum * 100) / 100;
  const roundedTotal = Math.round(inv.totalAmount * 100) / 100;
  const totalsAligned = Math.abs(roundedSum - roundedTotal) < 0.005;

  return (
    <div
      id="invoice-print-surface"
      className="invoice-print-surface relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-2xl border border-stone-300/60 bg-[#fbfaf9] text-[#1c1917] shadow-[0_28px_90px_-24px_rgba(28,25,23,0.38),0_0_0_1px_rgba(255,255,255,0.65)_inset] print:max-w-none print:rounded-none print:border-0 print:shadow-none"
      style={{ fontFamily: SANS }}
    >
      <div className="flex h-1.5 w-full">
        <div className="h-full flex-[7] bg-[#0f172a]" />
        <div className="h-full flex-1 bg-[#c9a227]" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.92]"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(ellipse 125% 85% at 100% -12%, rgba(59, 130, 246, 0.085), transparent 52%),
            radial-gradient(ellipse 95% 75% at -8% 108%, rgba(201, 162, 39, 0.06), transparent 46%),
            linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(252, 251, 249, 1) 42%, rgba(250, 249, 247, 1) 100%)
          `,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        aria-hidden
        style={{
          backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.045) 1.2px, transparent 1.2px)',
          backgroundSize: '18px 18px',
        }}
      />

      <div
        className="pointer-events-none absolute right-4 top-[5.25rem] select-none sm:right-10 sm:top-[6rem]"
        aria-hidden
        style={{
          fontFamily: SERIF,
          fontSize: 'clamp(4rem, 14vw, 7.5rem)',
          fontWeight: 700,
          lineHeight: 0.85,
          letterSpacing: '-0.02em',
          color: 'rgba(15, 23, 42, 0.032)',
        }}
      >
        INVOICE
      </div>
      <div
        className="pointer-events-none absolute bottom-[42%] left-4 max-w-[min(200px,45vw)] select-none font-mono text-[10px] font-medium leading-relaxed text-stone-900/[0.045] sm:left-8"
        aria-hidden
      >
        {label}
        <br />
        REF · {inv.invoiceId}
      </div>

      <div className="relative px-7 pb-11 pt-10 sm:px-11 sm:pb-14 sm:pt-12">
        <header className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-12">
          <div className="min-w-0 space-y-8">
            <div className="relative border-l-[3px] border-[#c9a227] pl-5 sm:pl-6">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-stone-500">Issued by</p>
              <h2
                className="mt-2 max-w-xl text-[1.65rem] font-semibold leading-tight tracking-tight text-[#0f172a] sm:text-[1.85rem]"
                style={{ fontFamily: SERIF }}
              >
                {org.name}
              </h2>
              {org.code ? (
                <p className="mt-2 inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-stone-600 shadow-sm ring-1 ring-stone-200/80">
                  <span className="text-stone-400">ORG</span>
                  <span className="text-stone-800">{org.code}</span>
                </p>
              ) : null}
            </div>

            <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
              <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(28,25,23,0.12)] ring-1 ring-black/[0.025]">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-stone-500">Bill to</p>
                <p className="mt-2 text-lg font-semibold leading-snug text-[#0f172a]" style={{ fontFamily: SERIF }}>
                  {inv.customerName}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-stone-100 pt-3 text-xs text-stone-600">
                  <span>
                    Customer ID <span className="font-mono font-medium text-stone-800">{inv.customerId}</span>
                  </span>
                </div>
              </div>

              <div className="hidden rounded-2xl border border-dashed border-stone-300/90 bg-white/60 p-5 text-xs leading-relaxed text-stone-600 sm:block">
                <p className="font-semibold uppercase tracking-wider text-stone-700">Payment reference</p>
                <p className="mt-2">
                  Quote <span className="font-mono font-semibold text-stone-800">{label}</span> on your transfer or NEFT remarks so we can reconcile quickly.
                </p>
                <p className="mt-3 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
                  Figures in <span className="font-semibold text-stone-700">{inv.currency}</span>, computed from posted lines at issuance.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 lg:max-w-[19rem]">
            <div className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.48)] ring-1 ring-black/[0.04]">
              <MetaCardCorners />
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-blue-500/[0.09] to-transparent"
                aria-hidden
              />

              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.26em] text-[#1e3a5f]">Tax invoice</p>
                  <p className="mt-2 font-mono text-[0.68rem] font-medium text-stone-400">Doc · INV-{inv.invoiceId}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide ring-1 ${statusChipClass(inv.status)}`}
                >
                  {inv.status}
                </span>
              </div>

              <div className="relative mt-6 border-t border-stone-100 pt-5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-stone-500">Invoice number</p>
                <p className="mt-1.5 break-all font-mono text-xl font-bold tracking-tight text-[#0f172a]">{label}</p>
              </div>

              <dl className="relative mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-stone-500">Issued</dt>
                  <dd className="mt-1 font-medium text-stone-900">{fmtIssueDate(inv.issueUtc)}</dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-stone-500">Currency</dt>
                  <dd className="mt-1 font-semibold text-stone-900">{inv.currency}</dd>
                </div>
              </dl>

              <div className="relative mt-6 rounded-xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#152042] p-4 text-white shadow-inner ring-1 ring-white/10">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-blue-100/80">Total payable</p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight sm:text-[1.65rem]">{fmtInr(inv.totalAmount)}</p>
                {amountWords ? (
                  <p className="mt-3 border-t border-white/10 pt-3 text-[11px] font-normal leading-snug text-blue-100/85">{amountWords}</p>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <SectionOrnament />

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-900/[0.08] pb-4">
            <div>
              <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-stone-800">Services &amp; products</h3>
              <p className="mt-1 text-xs text-stone-500">Qty × rate with stored line totals</p>
            </div>
            <p className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-stone-600 ring-1 ring-stone-200/80">
              {inv.lines.length} line{inv.lines.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_4px_28px_-14px_rgba(28,25,23,0.22)] ring-1 ring-black/[0.03]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="bg-gradient-to-r from-[#172554] via-[#1e3a5f] to-[#1e293b] text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white">
                    <th className="w-10 px-3 py-3.5 text-center font-semibold text-blue-100/90">#</th>
                    <th className="min-w-[200px] px-4 py-3.5">Description</th>
                    <th className="hidden px-3 py-3.5 sm:table-cell">Ref</th>
                    <th className="px-3 py-3.5 text-right tabular-nums">Qty</th>
                    <th className="px-4 py-3.5 text-right tabular-nums">Rate</th>
                    <th className="border-l border-white/10 bg-black/10 px-4 py-3.5 text-right tabular-nums text-blue-50">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((line, idx) => (
                    <tr
                      key={line.invoiceLineId}
                      className={`border-b border-stone-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#fafaf9]'}`}
                    >
                      <td className="px-3 py-4 text-center font-mono text-[11px] font-semibold text-stone-400">{idx + 1}</td>
                      <td className="px-4 py-4 align-top">
                        <span className="font-medium leading-snug text-stone-900">{line.description}</span>
                      </td>
                      <td className="hidden px-3 py-4 align-top font-mono text-[11px] text-stone-500 sm:table-cell">
                        {line.productId != null ? `#${line.productId}` : '—'}
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums text-stone-700">{line.quantity}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-stone-600">{fmtInr(line.unitPrice)}</td>
                      <td className="border-l border-stone-200/90 bg-stone-50/[0.65] px-4 py-4 text-right font-semibold tabular-nums text-[#0f172a]">
                        {fmtInr(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#c9a227]/40 bg-[linear-gradient(180deg,#fafaf9_0%,#f5f4f2_100%)]">
                    <td colSpan={5} className="px-4 py-4 align-middle">
                      <div className="text-right sm:ml-auto sm:max-w-md">
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-stone-600">
                          Invoice total · {inv.currency}
                        </p>
                        {totalsAligned ? (
                          <p className="mt-1 text-[11px] text-stone-500">
                            Lines reconcile ·{' '}
                            <span className="font-mono font-semibold text-stone-700">{fmtInr(roundedSum)}</span>
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-amber-800/95">Use invoice header total as the final amount.</p>
                        )}
                      </div>
                    </td>
                    <td className="border-l border-stone-200/90 bg-white px-4 py-4 text-right font-mono text-lg font-bold tabular-nums text-[#0f172a]">
                      {fmtInr(inv.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        <div className="mt-10 rounded-2xl border border-stone-200/90 bg-[#fafaf9] px-6 py-5 shadow-sm ring-1 ring-black/[0.03]">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-stone-700">Settlement snapshot</p>
          <dl className="mt-4 grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Invoice total</dt>
              <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#0f172a]">{fmtInr(inv.totalAmount)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Received to date</dt>
              <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-800">{fmtInr(inv.amountPaid)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Balance due</dt>
              <dd
                className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                  inv.balanceDue <= 0.009 ? 'text-emerald-800' : 'text-amber-900'
                }`}
              >
                {fmtInr(Math.max(0, inv.balanceDue))}
              </dd>
            </div>
          </dl>
          {inv.payments.length > 0 ? (
            <ul className="mt-5 space-y-2 border-t border-stone-200/80 pt-4 text-[11px] text-stone-600">
              {inv.payments.map((p) => (
                <li key={p.invoicePaymentId} className="flex flex-wrap justify-between gap-2 border-b border-stone-100/90 pb-2 last:border-0">
                  <span className="font-medium text-stone-700">{fmtIssueDate(p.receivedUtc)}</span>
                  <span className="text-stone-500">{p.channel?.replace(/_/g, ' ') ?? '—'}</span>
                  <span className="font-mono font-semibold text-stone-900">{fmtInr(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[11px] text-stone-500">No receipts recorded at the time this PDF was generated.</p>
          )}
        </div>

        <footer className="mt-12 flex flex-col gap-10 border-t border-stone-200/90 pt-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-5">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <VerifiedSeal />
              <div>
                <p className="text-[13px] leading-relaxed text-stone-600">
                  Thank you for your business. Please quote <span className="font-mono font-semibold text-stone-800">{label}</span> on remittance.
                  Totals reflect the ledger state at <span className="font-medium text-stone-800">{fmtIssueDate(inv.issueUtc)}</span>.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="h-px flex-1 max-w-[160px] bg-gradient-to-r from-stone-400 to-transparent" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">Authorized signatory</span>
                  <div className="hidden h-px flex-1 max-w-[100px] bg-gradient-to-l from-transparent to-stone-200 sm:block" />
                </div>
              </div>
            </div>
          </div>
          <div className="text-right lg:min-w-[200px]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Prepared for</p>
            <p className="mt-1 text-base font-semibold text-[#0f172a]" style={{ fontFamily: SERIF }}>
              {org.name}
            </p>
            <p className="mt-1 font-mono text-[11px] text-stone-500">{label}</p>
          </div>
        </footer>
      </div>

      <div className="flex h-1 w-full">
        <div className="h-full flex-1 bg-[#c9a227]" />
        <div className="h-full flex-[7] bg-[#0f172a]" />
      </div>
    </div>
  );
}
