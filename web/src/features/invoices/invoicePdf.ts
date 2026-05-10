/** Client-side PDF from the printable invoice DOM node (html2canvas-pro + jsPDF). */

import { printPdfFromHtmlElement, savePdfFromHtmlElement } from '../../shared/print/htmlToPdf';

export async function downloadInvoicePdf(printSurface: HTMLElement, filename: string): Promise<void> {
  await savePdfFromHtmlElement(printSurface, filename);
}

export async function printInvoicePdf(printSurface: HTMLElement): Promise<void> {
  await printPdfFromHtmlElement(printSurface);
}

export function invoicePdfFilename(invoiceNumber: string | null | undefined, invoiceId: number): string {
  const base = (invoiceNumber ?? `invoice-${invoiceId}`).replace(/[^\w.\-]+/g, '_').slice(0, 120);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}
