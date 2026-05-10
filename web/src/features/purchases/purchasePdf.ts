import { printPdfFromHtmlElement, savePdfFromHtmlElement } from '../../shared/print/htmlToPdf';

export async function downloadPurchasePdf(printSurface: HTMLElement, filename: string): Promise<void> {
  await savePdfFromHtmlElement(printSurface, filename);
}

/** Opens system print dialog on a PDF rendered from the same DOM as preview (production — avoids window.print mismatches). */
export async function printPurchasePdf(printSurface: HTMLElement): Promise<void> {
  await printPdfFromHtmlElement(printSurface);
}

export function purchasePdfFilename(purchaseNumber: string | null | undefined, purchaseBillId: number): string {
  const base = (purchaseNumber ?? `purchase-${purchaseBillId}`).replace(/[^\w.\-]+/g, '_').slice(0, 120);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}
