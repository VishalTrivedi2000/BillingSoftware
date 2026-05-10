import type { PurchasePrintAccent } from './purchasePrintTypes';

/** Small gradient tokens for template carousel thumbnails (settings + print studio). */
export const PURCHASE_PRINT_ACCENT_PREVIEW: Record<PurchasePrintAccent, string> = {
  emerald: 'from-emerald-700 to-teal-900',
  red: 'from-red-600 to-red-950',
  blue: 'from-blue-600 to-slate-900',
  stone: 'from-stone-500 to-stone-800',
  amber: 'from-amber-600 to-orange-900',
  teal: 'from-teal-600 to-cyan-900',
  cyan: 'from-cyan-600 to-teal-900',
  slate: 'from-slate-600 to-slate-900',
  zinc: 'from-zinc-500 to-zinc-800',
  violet: 'from-violet-700 to-purple-950',
};
