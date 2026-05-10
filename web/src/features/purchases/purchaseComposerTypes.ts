export type DraftLine = {
  key: string;
  productId: number | null;
  description: string;
  quantity: number;
  unitCost: number;
  discountPercent: number;
  discountAmount: number;
  taxRatePercent: number;
};

export type PurchaseComposerDraft = {
  partyId: number | '';
  lines: DraftLine[];
  /** Server draft bill id once created; stays on /purchases/new/:tabId URL. */
  serverDraftId: number | null;
};

export type PurchaseComposerTab = {
  id: string;
  title: string;
};
