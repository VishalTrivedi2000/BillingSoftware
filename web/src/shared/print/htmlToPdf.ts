/**
 * Production PDF pipeline: rasterize DOM with html2canvas-pro → jsPDF (multi-page A4).
 * Uses html2canvas-pro (not html2canvas): Tailwind v4 emits oklch(); vanilla html2canvas throws on parse.
 * Used for download and for Print (opens system print dialog on generated PDF — consistent output vs browser window.print).
 */

import { mirrorResolvedPaintOntoClone } from './mirrorClonePaint';

export type BuildPdfOptions = {
  /** Canvas scale; higher = sharper PDF, larger file. Default 2.5 */
  scale?: number;
};

export async function buildPdfFromHtmlElement(
  element: HTMLElement,
  options?: BuildPdfOptions,
): Promise<InstanceType<Awaited<typeof import('jspdf').default>>> {
  const scale = options?.scale ?? 2.5;
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas-pro'),
  ]);

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    imageTimeout: 20_000,
    removeContainer: true,
    onclone(clonedDoc) {
      const live = document.getElementById(element.id);
      const node = clonedDoc.getElementById(element.id);
      if (live instanceof HTMLElement && node instanceof HTMLElement) {
        node.style.transform = 'none';
        node.style.zoom = '1';
        mirrorResolvedPaintOntoClone(live, node);
        node.style.boxShadow = 'none';
      }
    },
  });

  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf;
}

export async function savePdfFromHtmlElement(element: HTMLElement, filename: string, opts?: BuildPdfOptions): Promise<void> {
  const pdf = await buildPdfFromHtmlElement(element, opts);
  pdf.save(filename);
}

/**
 * Opens the OS print dialog for a PDF generated from the live DOM (matches preview/download pixels).
 */
export async function printPdfFromHtmlElement(element: HTMLElement, opts?: BuildPdfOptions): Promise<void> {
  const pdf = await buildPdfFromHtmlElement(element, opts);
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;

  const cleanup = () => {
    URL.revokeObjectURL(url);
    iframe.remove();
  };

  document.body.appendChild(iframe);

  iframe.onload = () => {
    const cw = iframe.contentWindow;
    if (!cw) {
      cleanup();
      return;
    }

    const onAfterPrint = () => {
      cw.removeEventListener('afterprint', onAfterPrint);
      cleanup();
    };

    cw.addEventListener('afterprint', onAfterPrint);
    cw.focus();
    cw.print();

    window.setTimeout(() => {
      if (!iframe.isConnected) return;
      cw.removeEventListener('afterprint', onAfterPrint);
      cleanup();
    }, 120_000);
  };

  iframe.onerror = () => cleanup();
}
