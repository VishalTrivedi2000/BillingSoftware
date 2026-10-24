import type { PurchasePrintAccent, PurchasePrintPreset } from './purchasePrintTypes';

/** Vyapar-style named skins (palette + hero layout), independent of billing preset engine. */
export type PurchaseThemeSkin = 'standard' | 'purple-french' | 'double-divine' | 'sale-purple';

export type PurchasePrintTemplateDef = {
  id: string;
  label: string;
  subtitle: string;
  preset: PurchasePrintPreset;
  accent: PurchasePrintAccent;
  themeSkin?: PurchaseThemeSkin;
};

/** Selectable print skins (carousel). */
export const PURCHASE_PRINT_TEMPLATES: readonly PurchasePrintTemplateDef[] = [
  { id: 'gst-emerald-classic', label: 'GST Emerald', subtitle: 'Classic luxury', preset: 'classic', accent: 'emerald' },
  { id: 'gst-ruby-band', label: 'Ruby band', subtitle: 'Bold red header', preset: 'vyapar', accent: 'red' },
  {
    id: 'french-elite-purple',
    label: 'French Elite',
    subtitle: 'Purple GST banner · Vyapar',
    preset: 'vyapar',
    accent: 'violet',
    themeSkin: 'purple-french',
  },
  {
    id: 'double-divine-curve',
    label: 'Double Divine',
    subtitle: 'Curve slab · red GST',
    preset: 'vyapar',
    accent: 'red',
    themeSkin: 'double-divine',
  },
  {
    id: 'theme-2-sale-purple',
    label: 'Theme 2',
    subtitle: 'Retail · Bill / Ship · purple',
    preset: 'classic',
    accent: 'violet',
    themeSkin: 'sale-purple',
  },
  { id: 'gst-sapphire-band', label: 'Sapphire band', subtitle: 'Blue corporate', preset: 'vyapar', accent: 'blue' },
  { id: 'minimal-ivory', label: 'Minimal ivory', subtitle: 'Sparse borders', preset: 'minimal', accent: 'stone' },
  { id: 'ledger-amber', label: 'Ledger amber', subtitle: 'Ruled account book', preset: 'ledger', accent: 'amber' },
  { id: 'dual-card-teal', label: 'Dual card', subtitle: 'Buyer & supplier tiles', preset: 'card', accent: 'teal' },
  { id: 'marine-compact', label: 'Marine compact', subtitle: 'Dense line grid', preset: 'compact', accent: 'cyan' },
  { id: 'slate-pro-header', label: 'Slate Pro', subtitle: 'Dark slab header', preset: 'slateHeader', accent: 'slate' },
  { id: 'thermal-zinc', label: 'Thermal A4', subtitle: 'Receipt-style', preset: 'thermal', accent: 'zinc' },
  { id: 'violet-gst-bold', label: 'Violet GST', subtitle: 'High-contrast table', preset: 'classic', accent: 'violet' },
];

export const DEFAULT_PURCHASE_PRINT_TEMPLATE_ID = PURCHASE_PRINT_TEMPLATES[0].id;

export function getPurchasePrintTemplate(id: string): PurchasePrintTemplateDef {
  return PURCHASE_PRINT_TEMPLATES.find((t) => t.id === id) ?? PURCHASE_PRINT_TEMPLATES[0];
}
