/** Calendar ranges in local timezone; formatted as `yyyy-MM-dd` for API DateOnly query params. */

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type PeriodPresetId = 'this_month' | 'last_month' | 'this_quarter' | 'this_fy_in' | 'custom';

export type PeriodRange = { from: string; to: string; label: string };

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** India FY: April → March */
function fyBoundsToday(now = new Date()): { start: Date; end: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const april = m >= 3;
  const startYear = april ? y : y - 1;
  const start = new Date(startYear, 3, 1);
  const end = new Date(startYear + 1, 2, 31);
  return { start, end };
}

export function rangeForPreset(id: PeriodPresetId, now = new Date()): PeriodRange {
  if (id === 'this_month') {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return { from: toIsoDate(start), to: toIsoDate(end), label: 'This month' };
  }
  if (id === 'last_month') {
    const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const start = startOfMonth(ref);
    const end = endOfMonth(ref);
    return { from: toIsoDate(start), to: toIsoDate(end), label: 'Last month' };
  }
  if (id === 'this_quarter') {
    const m = now.getMonth();
    const qStartMonth = Math.floor(m / 3) * 3;
    const start = new Date(now.getFullYear(), qStartMonth, 1);
    const end = new Date(now.getFullYear(), qStartMonth + 3, 0);
    return { from: toIsoDate(start), to: toIsoDate(end), label: 'This quarter' };
  }
  if (id === 'this_fy_in') {
    const { start, end } = fyBoundsToday(now);
    return { from: toIsoDate(start), to: toIsoDate(end), label: 'This FY (Apr–Mar)' };
  }
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  return { from: toIsoDate(start), to: toIsoDate(end), label: 'Custom range' };
}

export const PRESET_OPTIONS: { id: PeriodPresetId; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_fy_in', label: 'This FY (India)' },
  { id: 'custom', label: 'Custom…' },
];
