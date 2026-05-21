/** Shared utilities for inventory feature pages. */

export function fmtInr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtNumber(n: number | null | undefined, max = 4): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: max }).format(n);
}

export function fmtQty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return n.toLocaleString('en-IN');
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n);
}

export function fmtSignedQty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  const formatted = Number.isInteger(abs)
    ? abs.toLocaleString('en-IN')
    : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(abs);
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `−${formatted}`;
  return '0';
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Compact label for transaction type chips. */
export function txTypeLabel(t: string): string {
  switch (t) {
    case 'OPENING_BALANCE':
      return 'Opening';
    case 'PURCHASE_RECEIPT':
      return 'Purchase';
    case 'SALE_ISSUE':
      return 'Sale';
    case 'SALE_RETURN':
      return 'Sale return';
    case 'PURCHASE_RETURN':
      return 'Purchase return';
    case 'TRANSFER_OUT':
      return 'Transfer out';
    case 'TRANSFER_IN':
      return 'Transfer in';
    case 'DAMAGE':
      return 'Damage';
    case 'ADJUSTMENT_POSITIVE':
      return 'Adjustment +';
    case 'ADJUSTMENT_NEGATIVE':
      return 'Adjustment −';
    case 'RESERVE':
      return 'Reserve';
    case 'RELEASE_RESERVATION':
      return 'Release';
    case 'COMMIT_RESERVATION':
      return 'Commit';
    case 'PRODUCTION_CONSUME':
      return 'Production -';
    case 'PRODUCTION_OUTPUT':
      return 'Production +';
    default:
      return t;
  }
}

export function txToneClass(t: string): string {
  const incoming = ['PURCHASE_RECEIPT', 'SALE_RETURN', 'TRANSFER_IN', 'ADJUSTMENT_POSITIVE', 'PRODUCTION_OUTPUT', 'OPENING_BALANCE'];
  const outgoing = ['SALE_ISSUE', 'PURCHASE_RETURN', 'TRANSFER_OUT', 'DAMAGE', 'ADJUSTMENT_NEGATIVE', 'PRODUCTION_CONSUME'];
  if (incoming.includes(t)) return 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30';
  if (outgoing.includes(t)) return 'bg-rose-500/10 text-rose-300 ring-rose-500/30';
  return 'bg-amber-500/10 text-amber-300 ring-amber-500/30';
}

export function expiryStatusTone(status: string | null | undefined): string {
  switch (status) {
    case 'Expired':
      return 'bg-rose-500/10 text-rose-300 ring-rose-500/30';
    case 'Near':
      return 'bg-amber-500/10 text-amber-300 ring-amber-500/30';
    case 'OK':
      return 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30';
    default:
      return 'bg-slate-500/10 text-slate-300 ring-slate-500/30';
  }
}

export function stockStatusTone(status: string | null | undefined): string {
  switch (status) {
    case 'OutOfStock':
      return 'bg-rose-500/10 text-rose-300 ring-rose-500/30';
    case 'Low':
      return 'bg-amber-500/10 text-amber-300 ring-amber-500/30';
    case 'InStock':
      return 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30';
    default:
      return 'bg-slate-500/10 text-slate-300 ring-slate-500/30';
  }
}
