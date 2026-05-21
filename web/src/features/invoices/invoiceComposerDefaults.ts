import type { InvoiceLineDto } from '../../entities/billing';
import type { InvoiceComposerDraft, InvoiceDraftLine } from './invoiceComposerTypes';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dueInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function newDraftLine(): InvoiceDraftLine {
  return {
    key: crypto.randomUUID(),
    productId: null,
    productVariantId: null,
    description: '',
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    taxRatePercent: 0,
    selectedSerials: [],
  };
}

export function mapInvoiceLineToDraft(line: InvoiceLineDto): InvoiceDraftLine {
  return {
    key: crypto.randomUUID(),
    productId: line.productId,
    productVariantId: null,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountPercent: 0,
    taxRatePercent: 0,
    selectedSerials: [],
  };
}

export function defaultComposerDraft(): InvoiceComposerDraft {
  return {
    customerId: '',
    billingAddress: '',
    gstin: '',
    warehouseId: '',
    orderDate: todayIsoDate(),
    dueDate: dueInDays(14),
    paymentMethod: 'Credit Card',
    salesChannel: 'Retail Store',
    reference: '',
    shippingAmount: 0,
    documentDiscount: 0,
    amountPaid: 0,
    shipToDifferent: false,
    deliveryRecipient: '',
    deliveryAddress: '',
    lines: [newDraftLine()],
  };
}
