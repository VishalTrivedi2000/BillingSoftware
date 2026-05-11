export type InvoiceDraftLine = {
  key: string;
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceComposerDraft = {
  customerId: number | '';
  lines: InvoiceDraftLine[];
};

export type InvoiceComposerTab = {
  id: string;
  title: string;
};
