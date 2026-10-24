/** Mirrors BillingApp.Application.Billing JSON payloads (camelCase from ASP.NET). */

export type DashboardMetricsDto = {
  customerCount: number;
  activeProductCount: number;
  invoiceCount: number;
  totalInvoicedAmount: number;
};

/** GET /v1/sales/summary — posted invoices + receipts in this organization */
export type SalesSummaryDto = {
  postedInvoiceCount: number;
  totalInvoicedAmount: number;
  totalCollectedAmount: number;
  totalOutstandingAmount: number;
};

export type InvoiceSummaryDto = {
  invoiceId: number;
  invoiceNumber: string | null;
  customerId: number;
  customerName: string;
  issueUtc: string;
  totalAmount: number;
  status: string;
  amountPaid: number;
  balanceDue: number;
  lastPaymentChannel: string | null;
};

export type InvoiceLineDto = {
  invoiceLineId: number;
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type InvoicePaymentEntryDto = {
  invoicePaymentId: number;
  amount: number;
  receivedUtc: string;
  channel: string | null;
  referenceNote: string | null;
};

export type InvoiceDetailDto = {
  invoiceId: number;
  invoiceNumber: string | null;
  customerId: number;
  customerName: string;
  issueUtc: string;
  currency: string;
  totalAmount: number;
  status: string;
  lines: InvoiceLineDto[];
  amountPaid: number;
  balanceDue: number;
  payments: InvoicePaymentEntryDto[];
};

export type RecordInvoicePaymentBody = {
  amount: number;
  receivedUtc?: string | null;
  channel?: string | null;
  referenceNote?: string | null;
};

export type CreateInvoiceLineBody = {
  productId?: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  productVariantId?: number | null;
  productSerialIds?: number[] | null;
};

export type CreateInvoiceBody = {
  customerId: number;
  lines: CreateInvoiceLineBody[];
};

export type PurchaseLineDto = {
  purchaseLineId: number;
  productId: number | null;
  description: string;
  quantity: number;
  unitCost: number;
  discountPercent: number;
  discountAmount: number;
  taxRatePercent: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
};

export type PurchaseBillSummaryDto = {
  purchaseBillId: number;
  purchaseNumber: string | null;
  partyId: number;
  supplierName: string;
  receivedUtc: string;
  totalAmount: number;
  status: string;
  amountPaid: number;
  balanceDue: number;
};

export type PurchaseBillDetailDto = {
  purchaseBillId: number;
  purchaseNumber: string | null;
  partyId: number;
  supplierName: string;
  receivedUtc: string;
  currency: string;
  totalAmount: number;
  status: string;
  lines: PurchaseLineDto[];
};

export type CreatePurchaseLineBody = {
  productId?: number | null;
  description: string;
  quantity: number;
  unitCost: number;
  discountPercent?: number;
  discountAmount?: number;
  taxRatePercent?: number;
};

export type CreatePurchaseBillBody = {
  partyId: number;
  lines: CreatePurchaseLineBody[];
};

export type CustomerDto = {
  customerId: number;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  createdUtc: string;
};

/** POST /v1/customers */
export type CreateCustomerBody = {
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
};

/** PATCH /v1/customers/{customerId} */
export type UpdateCustomerBody = CreateCustomerBody;

export type PartyDto = {
  partyId: number;
  kind: string;
  displayName: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  createdUtc: string;
};

export type CreatePartyBody = {
  kind: string;
  displayName: string;
  legalName?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export type UpdatePartyBody = CreatePartyBody & { isActive: boolean };

export type ProductDto = {
  productId: number;
  sku: string | null;
  name: string;
  brand?: string | null;
  brandId?: number | null;
  unitPrice: number;
  stockQty?: number;
  lowStockThreshold?: number | null;
  categoryId?: number | null;
  categoryName?: string | null;
  unitId?: number | null;
  unitName?: string | null;
  primaryImageRelativePath?: string | null;
  isActive: boolean;
  createdUtc: string;
  /** Harmonized System code for GST */
  hsnCode?: string | null;
  description?: string | null;
  mrp?: number | null;
  /** Default purchase / cost reference for inward bills */
  purchasePrice?: number | null;
  wholesalePrice?: number | null;
  minWholesaleQty?: number | null;
  /** Default GST % for this SKU (line-level tax still future work) */
  taxRatePercent?: number | null;
  storageLocation?: string | null;
  /** When true, purchase lines do not increment StockQty */
  isService?: boolean;
  tags?: string | null;
  manufacturer?: string | null;
  barcode?: string | null;
  countryOfOrigin?: string | null;
  internalCode?: string | null;
  manufacturerPartNo?: string | null;
  visibility?: string | null;
  inventoryTrackingMode?: string | null;
  productNature?: string | null;
  hasVariants?: boolean;
  allowNegativeStock?: boolean;
  leadTimeDays?: number | null;
  warrantyMonths?: number | null;
  shelfLifeDays?: number | null;
  isReturnable?: boolean;
  reorderQty?: number | null;
  maxStock?: number | null;
  lowStockAlert?: boolean;
};

export type ProductCategoryDto = {
  categoryId: number;
  parentCategoryId: number | null;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type ProductBrandDto = {
  brandId: number;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type ProductUnitDto = {
  unitId: number;
  code: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
};

export type ProductBrowseResult = {
  items: ProductDto[];
  totalCount: number;
};

export type ProductInventorySummaryDto = {
  totalSkus: number;
  activeSkus: number;
  outOfStockCount: number;
  lowStockAlertCount: number;
  inventoryValueAtRetail: number;
};
