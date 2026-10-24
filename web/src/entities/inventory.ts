/**
 * Universal Product & Inventory Management — TypeScript transport types.
 *
 * Mirror BillingApp.Application.Inventory DTOs. ASP.NET serialises with camelCase
 * by default, so we follow camelCase here. Quantity fields are numbers (decimal on
 * the server; the API rounds to 6 fractional places).
 */

export const InventoryTrackingModes = {
  None: 'None',
  Quantity: 'Quantity',
  Batch: 'Batch',
  Serial: 'Serial',
  BatchAndSerial: 'BatchAndSerial',
} as const;
export type InventoryTrackingMode =
  (typeof InventoryTrackingModes)[keyof typeof InventoryTrackingModes];

export const ProductNatures = {
  Physical: 'Physical',
  Service: 'Service',
  Digital: 'Digital',
  Bundle: 'Bundle',
  RawMaterial: 'RawMaterial',
  Asset: 'Asset',
} as const;
export type ProductNature = (typeof ProductNatures)[keyof typeof ProductNatures];

export const WarehouseTypes = {
  Store: 'Store',
  Online: 'Online',
  Return: 'Return',
  Damage: 'Damage',
  Transit: 'Transit',
} as const;
export type WarehouseType = (typeof WarehouseTypes)[keyof typeof WarehouseTypes];

export const InventoryTransactionTypes = {
  OpeningBalance: 'OPENING_BALANCE',
  PurchaseReceipt: 'PURCHASE_RECEIPT',
  SaleIssue: 'SALE_ISSUE',
  SaleReturn: 'SALE_RETURN',
  PurchaseReturn: 'PURCHASE_RETURN',
  TransferOut: 'TRANSFER_OUT',
  TransferIn: 'TRANSFER_IN',
  Damage: 'DAMAGE',
  AdjustmentPositive: 'ADJUSTMENT_POSITIVE',
  AdjustmentNegative: 'ADJUSTMENT_NEGATIVE',
  Reserve: 'RESERVE',
  ReleaseReservation: 'RELEASE_RESERVATION',
  CommitReservation: 'COMMIT_RESERVATION',
  ProductionConsume: 'PRODUCTION_CONSUME',
  ProductionOutput: 'PRODUCTION_OUTPUT',
} as const;
export type InventoryTransactionType =
  (typeof InventoryTransactionTypes)[keyof typeof InventoryTransactionTypes];

export const InventoryQuantityBuckets = {
  Available: 'Available',
  Reserved: 'Reserved',
  Damaged: 'Damaged',
  Incoming: 'Incoming',
  InTransit: 'InTransit',
} as const;
export type InventoryQuantityBucket =
  (typeof InventoryQuantityBuckets)[keyof typeof InventoryQuantityBuckets];

export const ReturnTypes = {
  CustomerReturn: 'CustomerReturn',
  SupplierReturn: 'SupplierReturn',
  Exchange: 'Exchange',
  WarrantyClaim: 'WarrantyClaim',
} as const;
export type ReturnType = (typeof ReturnTypes)[keyof typeof ReturnTypes];

/* ============================================================================
   Warehouses
   ============================================================================ */
export type WarehouseDto = {
  warehouseId: number;
  code: string;
  name: string;
  warehouseType: WarehouseType;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
  managerName: string | null;
  managerEmail: string | null;
  managerPhone: string | null;
  allowNegativeStock: boolean;
  isDefault: boolean;
  isActive: boolean;
  createdUtc: string;
  updatedUtc: string | null;
};

export type CreateWarehouseBody = {
  code: string;
  name: string;
  warehouseType: WarehouseType;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
  managerName?: string | null;
  managerEmail?: string | null;
  managerPhone?: string | null;
  allowNegativeStock?: boolean;
  isDefault?: boolean;
};

export type UpdateWarehouseBody = CreateWarehouseBody & { isActive: boolean };

/* ============================================================================
   Variants
   ============================================================================ */
export type ProductVariantAttributeDto = { key: string; value: string };

export type ProductVariantDto = {
  productVariantId: number;
  productId: number;
  productName: string;
  sku: string | null;
  barcode: string | null;
  displayName: string | null;
  attributeHash: string | null;
  mrp: number | null;
  salePrice: number | null;
  purchasePrice: number | null;
  inventoryTrackingMode: InventoryTrackingMode | null;
  isDefault: boolean;
  status: string;
  isActive: boolean;
  createdUtc: string;
  updatedUtc: string | null;
  attributes: ProductVariantAttributeDto[];
};

export type CreateProductVariantBody = {
  productId: number;
  sku?: string | null;
  barcode?: string | null;
  displayName?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  purchasePrice?: number | null;
  inventoryTrackingMode?: InventoryTrackingMode | null;
  attributes: ProductVariantAttributeDto[];
};

export type UpdateProductVariantBody = {
  sku?: string | null;
  barcode?: string | null;
  displayName?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  purchasePrice?: number | null;
  inventoryTrackingMode?: InventoryTrackingMode | null;
  status: string;
  isActive: boolean;
  attributes: ProductVariantAttributeDto[];
};

export type VariantBrowseResult = {
  items: ProductVariantDto[];
  totalCount: number;
};

/* ============================================================================
   Inventory ledger + balance
   ============================================================================ */
export type InventoryTransactionDto = {
  inventoryTransactionId: number;
  productVariantId: number;
  variantDisplay: string;
  sku: string | null;
  warehouseId: number;
  warehouseName: string;
  batchId: number | null;
  batchNumber: string | null;
  productSerialId: number | null;
  serialNumber: string | null;
  transactionType: InventoryTransactionType;
  quantityBucket: InventoryQuantityBucket;
  qtyChange: number;
  costPerUnit: number | null;
  sourceDocumentType: string | null;
  sourceDocumentId: number | null;
  sourceLineId: number | null;
  reversalOfTransactionId: number | null;
  reason: string | null;
  createdBy: string | null;
  createdUtc: string;
};

export type InventoryLedgerResult = {
  items: InventoryTransactionDto[];
  totalCount: number;
};

export type InventoryBalanceDto = {
  productVariantId: number;
  variantDisplay: string;
  sku: string | null;
  productId: number;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  batchId: number | null;
  batchNumber: string | null;
  expiryDate: string | null;
  onHandQty: number;
  reservedQty: number;
  damagedQty: number;
  incomingQty: number;
  inTransitQty: number;
  availableQty: number;
  averageCost: number | null;
  updatedUtc: string;
};

export type InventoryBalanceResult = {
  items: InventoryBalanceDto[];
  totalCount: number;
};

export type InventoryWarehouseTileDto = {
  warehouseId: number;
  name: string;
  onHandQty: number;
  availableQty: number;
  skuCount: number;
};

export type InventoryRecentLedgerDto = {
  inventoryTransactionId: number;
  createdUtc: string;
  transactionType: InventoryTransactionType;
  variantDisplay: string;
  warehouseName: string;
  qtyChange: number;
  reason: string | null;
};

export type InventoryDashboardDto = {
  totalWarehouses: number;
  totalVariants: number;
  totalProducts: number;
  totalOnHandQty: number;
  totalAvailableQty: number;
  totalReservedQty: number;
  inventoryValueAtCost: number;
  lowStockSkuCount: number;
  outOfStockSkuCount: number;
  nearExpiryBatchCount: number;
  expiredBatchCount: number;
  openReservationCount: number;
  activeSerialsCount: number;
  warehouseTiles: InventoryWarehouseTileDto[];
  recentLedger: InventoryRecentLedgerDto[];
};

/* ============================================================================
   Stock adjustment
   ============================================================================ */
export type StockAdjustmentLineBody = {
  productVariantId: number;
  batchId?: number | null;
  productSerialId?: number | null;
  actualQty: number;
  systemQty: number;
  reason?: string | null;
};

export type SubmitStockAdjustmentBody = {
  warehouseId: number;
  reason: string;
  notes?: string | null;
  requireApproval: boolean;
  lines: StockAdjustmentLineBody[];
};

export type StockAdjustmentResultDto = {
  adjustmentApprovalId: number | null;
  adjustmentNumber: string | null;
  status: string;
  postedTransactionCount: number;
};

/* ============================================================================
   Stock transfer
   ============================================================================ */
export type StockTransferLineBody = {
  productVariantId: number;
  batchId?: number | null;
  quantity: number;
  unitCost?: number | null;
};

export type CreateStockTransferBody = {
  fromWarehouseId: number;
  toWarehouseId: number;
  transferDateUtc?: string | null;
  referenceCode?: string | null;
  notes?: string | null;
  lines: StockTransferLineBody[];
};

export type StockTransferLineDto = {
  productVariantId: number;
  variantDisplay: string;
  sku: string | null;
  batchId: number | null;
  batchNumber: string | null;
  quantity: number;
  unitCost: number | null;
  lineValue: number | null;
};

export type StockTransferDto = {
  stockTransferId: number;
  transferNumber: string;
  fromWarehouseId: number;
  fromWarehouseName: string;
  toWarehouseId: number;
  toWarehouseName: string;
  transferDateUtc: string;
  status: string;
  lineCount: number;
  totalQuantity: number;
  totalValue: number | null;
  notes: string | null;
  createdBy: string | null;
  createdUtc: string;
  lines: StockTransferLineDto[];
};

export type StockTransferSummaryDto = {
  stockTransferId: number;
  transferNumber: string;
  fromWarehouseId: number;
  fromWarehouseName: string;
  toWarehouseId: number;
  toWarehouseName: string;
  transferDateUtc: string;
  status: string;
  lineCount: number;
  totalQuantity: number;
  totalValue: number | null;
};

/* ============================================================================
   Reservations
   ============================================================================ */
export type CreateReservationLineBody = {
  productVariantId: number;
  warehouseId: number;
  batchId?: number | null;
  productSerialId?: number | null;
  quantity: number;
};

export type CreateReservationBody = {
  referenceCode?: string | null;
  customerId?: number | null;
  customerLabel?: string | null;
  validUntilUtc?: string | null;
  notes?: string | null;
  lines: CreateReservationLineBody[];
};

export type ReservationLineDto = {
  inventoryReservationLineId: number;
  productVariantId: number;
  variantDisplay: string;
  sku: string | null;
  warehouseId: number;
  warehouseName: string;
  batchId: number | null;
  batchNumber: string | null;
  productSerialId: number | null;
  serialNumber: string | null;
  quantity: number;
  status: string;
};

export type ReservationDto = {
  inventoryReservationId: number;
  referenceCode: string | null;
  customerId: number | null;
  customerLabel: string | null;
  reservationDateUtc: string;
  validUntilUtc: string | null;
  status: string;
  notes: string | null;
  createdBy: string | null;
  createdUtc: string;
  updatedUtc: string | null;
  totalQuantity: number;
  lines: ReservationLineDto[];
};

export type ReservationSummaryDto = {
  inventoryReservationId: number;
  referenceCode: string | null;
  customerId: number | null;
  customerLabel: string | null;
  reservationDateUtc: string;
  validUntilUtc: string | null;
  status: string;
  lineCount: number;
  totalQuantity: number;
};

/* ============================================================================
   Batches & serials
   ============================================================================ */
export type BatchDto = {
  batchId: number;
  productVariantId: number;
  variantDisplay: string;
  sku: string | null;
  batchNumber: string;
  lotNumber: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  qualityStatus: string;
  costPerUnit: number | null;
  supplierPartyId: number | null;
  supplierName: string | null;
  notes: string | null;
  isActive: boolean;
  createdUtc: string;
};

export type CreateBatchBody = {
  productVariantId: number;
  batchNumber: string;
  lotNumber?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  qualityStatus: string;
  costPerUnit?: number | null;
  supplierPartyId?: number | null;
  notes?: string | null;
};

export type BatchBrowseResult = {
  items: BatchDto[];
  totalCount: number;
};

export type ProductSerialDto = {
  productSerialId: number;
  productVariantId: number;
  variantDisplay: string;
  sku: string | null;
  serialNumber: string;
  imei1: string | null;
  imei2: string | null;
  warehouseId: number | null;
  warehouseName: string | null;
  batchId: number | null;
  batchNumber: string | null;
  purchaseCostPerUnit: number | null;
  status: string;
  soldInvoiceLineId: number | null;
  warrantyStartUtc: string | null;
  warrantyEndUtc: string | null;
  notes: string | null;
  createdUtc: string;
};

export type CreateProductSerialBody = {
  productVariantId: number;
  serialNumber: string;
  imei1?: string | null;
  imei2?: string | null;
  warehouseId?: number | null;
  batchId?: number | null;
  purchaseCostPerUnit?: number | null;
  warrantyStartUtc?: string | null;
  warrantyEndUtc?: string | null;
  notes?: string | null;
};

export type SerialBrowseResult = {
  items: ProductSerialDto[];
  totalCount: number;
};

/* ============================================================================
   Returns / RMA
   ============================================================================ */
export type ReturnLineBody = {
  productVariantId?: number | null;
  productSerialId?: number | null;
  batchId?: number | null;
  quantity: number;
  unitRefundAmount?: number | null;
  reason?: string | null;
  disposition?: string | null;
  notes?: string | null;
};

export type CreateReturnBody = {
  returnType: ReturnType;
  sourceDocumentType?: string | null;
  sourceDocumentId?: number | null;
  partyId?: number | null;
  warehouseId?: number | null;
  reason?: string | null;
  notes?: string | null;
  lines: ReturnLineBody[];
};

export type ReturnLineDto = {
  returnLineId: number;
  productVariantId: number | null;
  variantDisplay: string | null;
  sku: string | null;
  productSerialId: number | null;
  serialNumber: string | null;
  batchId: number | null;
  batchNumber: string | null;
  quantity: number;
  unitRefundAmount: number | null;
  lineRefundAmount: number | null;
  reason: string | null;
  disposition: string | null;
  inspectionResult: string | null;
  notes: string | null;
};

export type ReturnDto = {
  returnAuthorizationId: number;
  returnNumber: string | null;
  returnType: ReturnType;
  sourceDocumentType: string | null;
  sourceDocumentId: number | null;
  partyId: number | null;
  partyName: string | null;
  warehouseId: number | null;
  warehouseName: string | null;
  reason: string | null;
  status: string;
  totalRefundAmount: number | null;
  notes: string | null;
  requestedUtc: string;
  approvedUtc: string | null;
  receivedUtc: string | null;
  inspectedUtc: string | null;
  completedUtc: string | null;
  createdBy: string | null;
  lines: ReturnLineDto[];
};

export type ReturnSummaryDto = {
  returnAuthorizationId: number;
  returnNumber: string | null;
  returnType: ReturnType;
  status: string;
  partyName: string | null;
  warehouseName: string | null;
  requestedUtc: string;
  lineCount: number;
  totalQuantity: number;
  totalRefundAmount: number | null;
};

export type ReturnBrowseResult = {
  items: ReturnSummaryDto[];
  totalCount: number;
};

/* ============================================================================
   Reports
   ============================================================================ */
export type StockSummaryReportRow = {
  productId: number;
  productVariantId: number;
  productName: string;
  sku: string | null;
  categoryName: string | null;
  warehouseName: string | null;
  warehouseId: number | null;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  damagedQty: number;
  averageCost: number | null;
  inventoryValueAtCost: number;
  stockStatus: string | null;
};

export type StockSummaryReport = {
  rows: StockSummaryReportRow[];
  totalOnHandValue: number;
  totalSkus: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
};

export type LowStockReportRow = {
  productId: number;
  productVariantId: number;
  productName: string;
  sku: string | null;
  categoryName: string | null;
  warehouseId: number | null;
  warehouseName: string | null;
  availableQty: number;
  lowStockThreshold: number | null;
  severity: string;
};

export type ExpiryFefoReportRow = {
  batchId: number;
  productVariantId: number;
  productName: string;
  sku: string | null;
  batchNumber: string;
  warehouseName: string | null;
  expiryDate: string | null;
  daysToExpiry: number | null;
  expiryStatus: string;
  onHandQty: number;
  unitCost: number | null;
  totalValueAtRisk: number | null;
};

export type SerialTraceReportRow = {
  productSerialId: number;
  serialNumber: string;
  productName: string;
  sku: string | null;
  status: string;
  purchaseLineId: number | null;
  purchaseBillId: number | null;
  purchaseInvoiceNumber: string | null;
  purchaseDateUtc: string | null;
  purchaseCostPerUnit: number | null;
  soldInvoiceLineId: number | null;
  soldInvoiceId: number | null;
  soldInvoiceNumber: string | null;
  soldDateUtc: string | null;
  sellingPrice: number | null;
  grossProfit: number | null;
  warehouseName: string | null;
};

export type ItemProfitReportRow = {
  productId: number;
  productVariantId: number;
  productName: string;
  sku: string | null;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
};

export type InventoryValuationReportRow = {
  productId: number;
  productVariantId: number;
  productName: string;
  sku: string | null;
  categoryName: string | null;
  warehouseId: number | null;
  warehouseName: string | null;
  onHandQty: number;
  averageCost: number | null;
  totalValue: number | null;
  ageDays: number | null;
  ageBucket: string | null;
};
