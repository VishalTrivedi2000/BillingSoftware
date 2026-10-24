import { roundMoney2 } from '../invoices/invoiceMoney';

/** Match Sql Decimal.Round(..., 4, MidpointRounding.AwayFromZero) for line gross. */
function roundMoney4(amount: number): number {
  const scaled = amount * 10000;
  const rounded = scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
  return rounded / 10000;
}

/** Mirrors server {@link PurchaseRepository} tax-exclusive purchase line math. */
export function computePurchaseLinePreview(
  quantity: number,
  unitCost: number,
  discountPercent: number,
  discountAmount: number,
  taxRatePercent: number,
): { taxableAmount: number; taxAmount: number; lineTotal: number } {
  const gross = roundMoney4(quantity * unitCost);
  const dp = Math.min(100, Math.max(0, discountPercent));
  const afterPct = gross * (1 - dp / 100);
  const da = Math.max(0, discountAmount);
  let taxable = afterPct - da;
  if (taxable < 0) taxable = 0;
  taxable = roundMoney2(taxable);
  const tr = Math.min(100, Math.max(0, taxRatePercent));
  const tax = roundMoney2((taxable * tr) / 100);
  const lineTotal = roundMoney2(taxable + tax);
  return { taxableAmount: taxable, taxAmount: tax, lineTotal };
}

export const GST_PRESETS = [0, 5, 12, 18, 28] as const;
