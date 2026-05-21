import { roundMoney2 } from './invoiceMoney';
import type { InvoiceDraftLine } from './invoiceComposerTypes';

export function lineAmounts(line: InvoiceDraftLine) {
  const subtotal = roundMoney2(line.quantity * line.unitPrice);
  const discount = roundMoney2(subtotal * (line.discountPercent / 100));
  const afterDiscount = roundMoney2(subtotal - discount);
  const tax = roundMoney2(afterDiscount * (line.taxRatePercent / 100));
  const total = roundMoney2(afterDiscount + tax);
  return { subtotal, discount, afterDiscount, tax, total };
}

export function lineEstCost(line: InvoiceDraftLine, productPurchasePrice?: number | null): number {
  if (line.selectedSerials.length > 0) {
    return roundMoney2(
      line.selectedSerials.reduce((s, x) => s + (x.purchaseCostPerUnit ?? productPurchasePrice ?? 0), 0),
    );
  }
  return roundMoney2((productPurchasePrice ?? 0) * line.quantity);
}
