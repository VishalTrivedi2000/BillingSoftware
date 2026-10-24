import type { DraftLine, PurchaseComposerDraft } from './purchaseComposerTypes';

export function newLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    productId: null,
    productVariantId: null,
    description: '',
    quantity: 1,
    unitCost: 0,
    discountPercent: 0,
    discountAmount: 0,
    taxRatePercent: 0,
  };
}

export function defaultPurchaseComposerDraft(): PurchaseComposerDraft {
  return { partyId: '', lines: [newLine()], serverDraftId: null };
}
