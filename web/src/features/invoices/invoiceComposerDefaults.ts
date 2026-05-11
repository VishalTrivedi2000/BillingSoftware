import type { InvoiceLineDto } from '../../entities/billing';
import type { InvoiceComposerDraft, InvoiceDraftLine } from './invoiceComposerTypes';

export function newDraftLine(): InvoiceDraftLine {
  return {
    key: crypto.randomUUID(),
    productId: null,
    description: '',
    quantity: 1,
    unitPrice: 0,
  };
}

export function mapInvoiceLineToDraft(line: InvoiceLineDto): InvoiceDraftLine {
  return {
    key: crypto.randomUUID(),
    productId: line.productId,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  };
}

export function defaultComposerDraft(): InvoiceComposerDraft {
  return { customerId: '', lines: [newDraftLine()] };
}
