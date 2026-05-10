/**
 * Quick-start row layouts for the purchase composer (client-side only).
 * Each template expands into editable draft lines with preset GST / discounts / row count.
 */

export type PurchaseComposerDraftLine = {
  key: string;
  productId: number | null;
  description: string;
  quantity: number;
  unitCost: number;
  discountPercent: number;
  discountAmount: number;
  taxRatePercent: number;
};

export type PurchaseTemplateDefinition = {
  id: string;
  label: string;
  summary: string;
  /** Applied to every row before row-specific fields. */
  rowDefaults?: Partial<Omit<PurchaseComposerDraftLine, 'key' | 'productId'>>;
  /** One draft row per entry (merged over rowDefaults). */
  rows: Partial<Omit<PurchaseComposerDraftLine, 'key' | 'productId'>>[];
};

function blankRow(overrides: Partial<Omit<PurchaseComposerDraftLine, 'key'>>): PurchaseComposerDraftLine {
  return {
    key: crypto.randomUUID(),
    productId: null,
    description: '',
    quantity: 1,
    unitCost: 0,
    discountPercent: 0,
    discountAmount: 0,
    taxRatePercent: 0,
    ...overrides,
  };
}

export const PURCHASE_TEMPLATES: readonly PurchaseTemplateDefinition[] = [
  {
    id: 'tpl-exempt-bos',
    label: 'Exempt — bill of supply',
    summary: 'Single line at 0% GST.',
    rows: [{ description: 'Goods — exempt / bill of supply', taxRatePercent: 0 }],
  },
  {
    id: 'tpl-retail-5',
    label: 'Retail — 5% slab',
    summary: 'One FMCG-style row at 5%.',
    rows: [{ description: 'Retail SKU — 5% GST', taxRatePercent: 5 }],
  },
  {
    id: 'tpl-standard-12',
    label: 'Standard — 12% slab',
    summary: 'Common packaged goods rate.',
    rows: [{ description: 'Stock — 12% GST', taxRatePercent: 12 }],
  },
  {
    id: 'tpl-standard-18',
    label: 'Standard — 18% slab',
    summary: 'Default electronics / industrial supplies.',
    rows: [{ description: 'Stock — 18% GST', taxRatePercent: 18, quantity: 1 }],
  },
  {
    id: 'tpl-luxury-28',
    label: 'Luxury / sin goods — 28%',
    summary: 'High slab placeholder.',
    rows: [{ description: 'Goods — 28% GST', taxRatePercent: 28 }],
  },
  {
    id: 'tpl-basket-four',
    label: 'Retail basket (4 lines)',
    summary: 'Four labelled rows at 18%; pick products next.',
    rowDefaults: { taxRatePercent: 18 },
    rows: [
      { description: 'Basket item A' },
      { description: 'Basket item B' },
      { description: 'Basket item C' },
      { description: 'Basket item D' },
    ],
  },
  {
    id: 'tpl-trade-discount',
    label: 'Wholesale + trade discount %',
    summary: 'Three rows with 7% line discount and 18% GST.',
    rowDefaults: { taxRatePercent: 18, discountPercent: 7 },
    rows: [{ description: 'Case pack — tier 1' }, { description: 'Case pack — tier 2' }, { description: 'Case pack — tier 3' }],
  },
  {
    id: 'tpl-cash-discount-flat',
    label: 'Cash discount (fixed ₹ / line)',
    summary: 'Two rows with small flat discount and 18% GST.',
    rowDefaults: { taxRatePercent: 18, discountAmount: 25 },
    rows: [{ description: 'Paid cash — line 1' }, { description: 'Paid cash — line 2' }],
  },
  {
    id: 'tpl-mixed-slabs',
    label: 'Mixed GST slabs',
    summary: 'Three rows at 28%, 18%, and 5%.',
    rows: [
      { description: 'High slab line', taxRatePercent: 28 },
      { description: 'Standard slab line', taxRatePercent: 18 },
      { description: 'Reduced slab line', taxRatePercent: 5 },
    ],
  },
  {
    id: 'tpl-bulk-grn',
    label: 'Bulk GRN (8 sparse rows)',
    summary: 'Eight lightweight rows for fast GRN entry.',
    rowDefaults: { taxRatePercent: 18, quantity: 1 },
    rows: [
      { description: 'GRN line 01' },
      { description: 'GRN line 02' },
      { description: 'GRN line 03' },
      { description: 'GRN line 04' },
      { description: 'GRN line 05' },
      { description: 'GRN line 06' },
      { description: 'GRN line 07' },
      { description: 'GRN line 08' },
    ],
  },
];

export function buildDraftLinesFromTemplate(templateId: string): PurchaseComposerDraftLine[] {
  const t = PURCHASE_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return [blankRow({})];
  const defaults = t.rowDefaults ?? {};
  return t.rows.map((row) => blankRow({ ...defaults, ...row }));
}
