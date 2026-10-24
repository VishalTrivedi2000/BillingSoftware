/**
 * Layout engine keyed by template family (shared rendering paths).
 */
export type PurchasePrintPreset =
  | 'classic'
  | 'vyapar'
  | 'minimal'
  | 'ledger'
  | 'card'
  | 'compact'
  | 'slateHeader'
  | 'thermal';

export type PurchasePrintAccent =
  | 'emerald'
  | 'red'
  | 'blue'
  | 'stone'
  | 'amber'
  | 'teal'
  | 'cyan'
  | 'slate'
  | 'zinc'
  | 'violet';

/**
 * Options mirrored loosely from competitor print settings (Vyapar-style).
 * Stored per organization in localStorage until a server-backed prefs API exists.
 */
export type PurchasePrintOptions = {
  showAmountInWords: boolean;
  /** Aggregate GST rows by line rate (combined %) */
  showTaxSummaryByRate: boolean;
  showLineDiscountColumns: boolean;
  showLineGstPercent: boolean;
  showLineTaxBreakdown: boolean;
  /** Vyapar-style vertical summary (subtotal / tax / total) */
  showTotalsSidebar: boolean;
  showTermsBlock: boolean;
  termsText: string;
  showFooterDescription: boolean;
  footerDescription: string;
  showSignature: boolean;
  signatureLabel: string;
  showTransportBlock: boolean;
  showBankPlaceholder: boolean;
  showPaymentModeLine: boolean;
  paymentModeLabel: string;
  /** When true, shows received + balance (amounts below are preview placeholders). */
  showReceivedAndBalance: boolean;
  receivedAmount: number;
  /** HSN/SAC column (placeholder until line APIs expose codes). */
  showHsnColumn: boolean;
  /** Single Discount & GST columns showing ₹ and % (Vyapar-style). */
  combinedLineDiscountAndGst: boolean;
  /** Solid red band on item table header/footer (GST invoice look). */
  useSolidRedGstTable: boolean;
  /** Dashed box beside bank details for QR / UPI artwork later. */
  showQrPaymentPlaceholder: boolean;
  /** Prefix for per-rate lines in the summary sidebar. */
  gstSummaryLinePrefix: 'IGST' | 'GST';
  /** Footer row: sum of line quantities when space allows. */
  showTotalItemQuantity: boolean;
  /** Printed near header — your GSTIN / address / phone for professional bills */
  orgGstinPlaceholder: string;
  orgAddressPlaceholder: string;
  orgPhonePlaceholder: string;
};

export const DEFAULT_PURCHASE_PRINT_OPTIONS: PurchasePrintOptions = {
  showAmountInWords: true,
  showTaxSummaryByRate: true,
  showLineDiscountColumns: true,
  showLineGstPercent: true,
  showLineTaxBreakdown: true,
  showTotalsSidebar: true,
  showTermsBlock: true,
  termsText:
    'Goods once sold will not be taken back. Subject to jurisdiction only. E. & O.E.\nThis is a purchase bill record for accounts payable — verify quantities on receipt.',
  showFooterDescription: true,
  footerDescription:
    'This purchase bill records amounts payable to the supplier party named above. Not a retail sales tax invoice.',
  showSignature: true,
  signatureLabel: 'Authorized Signatory',
  showTransportBlock: false,
  showBankPlaceholder: true,
  showPaymentModeLine: true,
  paymentModeLabel: 'NEFT / RTGS',
  showReceivedAndBalance: false,
  receivedAmount: 0,
  showHsnColumn: true,
  combinedLineDiscountAndGst: true,
  useSolidRedGstTable: true,
  showQrPaymentPlaceholder: true,
  gstSummaryLinePrefix: 'IGST',
  showTotalItemQuantity: true,
  orgGstinPlaceholder: '',
  orgAddressPlaceholder: '',
  orgPhonePlaceholder: '',
};

export type PurchasePrintPrefsState = {
  /** Must match a template id from PURCHASE_PRINT_TEMPLATES */
  templateId: string;
  options: PurchasePrintOptions;
};
