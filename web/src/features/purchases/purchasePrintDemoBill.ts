import type { PurchaseBillDetailDto } from '../../entities/billing';

/** Synthetic bill for theme preview where no real purchase is loaded (Settings page). */
export function demoPurchaseBillForThemePreview(): PurchaseBillDetailDto {
  const iso = new Date().toISOString();
  return {
    purchaseBillId: 0,
    purchaseNumber: 'PUR-PREVIEW',
    partyId: 90001,
    supplierName: 'Classic Enterprises Pvt Ltd',
    receivedUtc: iso,
    currency: 'INR',
    totalAmount: 23470,
    status: 'Posted',
    lines: [
      {
        purchaseLineId: 1,
        productId: 101,
        description: 'Industrial fasteners — demo line A',
        quantity: 10,
        unitCost: 1000,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 18,
        taxableAmount: 10000,
        taxAmount: 1800,
        lineTotal: 11800,
      },
      {
        purchaseLineId: 2,
        productId: 102,
        description: 'Cable harness assembly — demo line B',
        quantity: 5,
        unitCost: 2000,
        discountPercent: 10,
        discountAmount: 1000,
        taxRatePercent: 18,
        taxableAmount: 9000,
        taxAmount: 1620,
        lineTotal: 10620,
      },
      {
        purchaseLineId: 3,
        productId: null,
        description: 'Consumables pack — demo line C',
        quantity: 2,
        unitCost: 500,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 5,
        taxableAmount: 1000,
        taxAmount: 50,
        lineTotal: 1050,
      },
    ],
  };
}
