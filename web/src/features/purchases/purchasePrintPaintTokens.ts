import type { CSSProperties } from 'react';
import type { PurchasePrintAccent } from './purchasePrintTypes';

/** Top ribbon strip — hex-only gradients (html2canvas-safe). */
export const ACCENT_TOP_BAND_CSS: Record<PurchasePrintAccent, string> = {
  emerald: 'linear-gradient(90deg, #047857 0%, #065f46 50%, #064e3b 100%)',
  red: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 55%, #7f1d1d 100%)',
  blue: 'linear-gradient(90deg, #2563eb 0%, #1e3a8a 70%, #0f172a 100%)',
  stone: 'linear-gradient(90deg, #78716c 0%, #57534e 55%, #44403c 100%)',
  amber: 'linear-gradient(90deg, #d97706 0%, #b45309 60%, #78350f 100%)',
  teal: 'linear-gradient(90deg, #0d9488 0%, #115e59 55%, #134e4a 100%)',
  cyan: 'linear-gradient(90deg, #0891b2 0%, #0f766e 55%, #164e63 100%)',
  slate: 'linear-gradient(90deg, #475569 0%, #334155 55%, #1e293b 100%)',
  zinc: 'linear-gradient(90deg, #71717a 0%, #52525b 55%, #3f3f46 100%)',
  violet: 'linear-gradient(90deg, #7c3aed 0%, #5b21b6 55%, #4c1d95 100%)',
};

/** Non-solid table header bands — hex-only. */
export const ACCENT_TABLE_HEAD_CSS: Record<PurchasePrintAccent, string> = {
  emerald: 'linear-gradient(90deg, #065f46 0%, #047857 40%, #059669 100%)',
  red: 'linear-gradient(90deg, #b91c1c 0%, #991b1b 50%, #7f1d1d 100%)',
  blue: 'linear-gradient(90deg, #1e40af 0%, #1e3a8a 45%, #172554 100%)',
  stone: 'linear-gradient(90deg, #57534e 0%, #44403c 45%, #292524 100%)',
  amber: 'linear-gradient(90deg, #b45309 0%, #92400e 45%, #78350f 100%)',
  teal: 'linear-gradient(90deg, #0f766e 0%, #115e59 45%, #134e4a 100%)',
  cyan: 'linear-gradient(90deg, #0e7490 0%, #155e75 45%, #164e63 100%)',
  slate: 'linear-gradient(90deg, #334155 0%, #1e293b 45%, #0f172a 100%)',
  zinc: 'linear-gradient(90deg, #52525b 0%, #3f3f46 45%, #27272a 100%)',
  violet: 'linear-gradient(90deg, #6d28d9 0%, #5b21b6 45%, #4c1d95 100%)',
};

export function purchaseStatusChipStyle(status: string): CSSProperties {
  const s = status.trim().toLowerCase();
  const base: CSSProperties = {
    borderRadius: 9999,
    padding: '2px 10px',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
  };
  if (s === 'posted') {
    return {
      ...base,
      backgroundColor: 'rgba(16, 185, 129, 0.14)',
      color: '#064e3b',
      border: '1px solid rgba(5, 150, 105, 0.28)',
    };
  }
  if (s === 'draft') {
    return {
      ...base,
      backgroundColor: 'rgba(245, 158, 11, 0.16)',
      color: '#78350f',
      border: '1px solid rgba(217, 119, 6, 0.35)',
    };
  }
  return {
    ...base,
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    color: '#1e293b',
    border: '1px solid rgba(148, 163, 184, 0.35)',
  };
}
