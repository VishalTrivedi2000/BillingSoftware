namespace BillingApp.Application.Inventory;

/* ============================================================================
   Universal Product & Inventory Management — Application DTOs.

   Conventions:
   - All DTOs are records (immutable transport shapes).
   - Money fields use decimal; quantity uses decimal with up to 6 fractional places.
   - Tenant/Org scoping is implicit via IWorkplaceContext on the server side.
   - Soft-delete + audit timestamps are surfaced for UI badges.
   ============================================================================ */

public static class InventoryTrackingModes
{
    public const string None = "None";
    public const string Quantity = "Quantity";
    public const string Batch = "Batch";
    public const string Serial = "Serial";
    public const string BatchAndSerial = "BatchAndSerial";
}

public static class ProductNatures
{
    public const string Physical = "Physical";
    public const string Service = "Service";
    public const string Digital = "Digital";
    public const string Bundle = "Bundle";
    public const string RawMaterial = "RawMaterial";
    public const string Asset = "Asset";
}

public static class WarehouseTypes
{
    public const string Store = "Store";
    public const string Online = "Online";
    public const string Return = "Return";
    public const string Damage = "Damage";
    public const string Transit = "Transit";
}

public static class InventoryTransactionTypes
{
    public const string OpeningBalance = "OPENING_BALANCE";
    public const string PurchaseReceipt = "PURCHASE_RECEIPT";
    public const string SaleIssue = "SALE_ISSUE";
    public const string SaleReturn = "SALE_RETURN";
    public const string PurchaseReturn = "PURCHASE_RETURN";
    public const string TransferOut = "TRANSFER_OUT";
    public const string TransferIn = "TRANSFER_IN";
    public const string Damage = "DAMAGE";
    public const string AdjustmentPositive = "ADJUSTMENT_POSITIVE";
    public const string AdjustmentNegative = "ADJUSTMENT_NEGATIVE";
    public const string Reserve = "RESERVE";
    public const string ReleaseReservation = "RELEASE_RESERVATION";
    public const string CommitReservation = "COMMIT_RESERVATION";
    public const string ProductionConsume = "PRODUCTION_CONSUME";
    public const string ProductionOutput = "PRODUCTION_OUTPUT";
}

public static class InventoryQuantityBuckets
{
    public const string Available = "Available";
    public const string Reserved = "Reserved";
    public const string Damaged = "Damaged";
    public const string Incoming = "Incoming";
    public const string InTransit = "InTransit";
}

/* ============================================================================
   Warehouses
   ============================================================================ */
public sealed record WarehouseDto(
    long WarehouseId,
    string Code,
    string Name,
    string WarehouseType,
    string? AddressLine1,
    string? AddressLine2,
    string? City,
    string? StateRegion,
    string? PostalCode,
    string? Country,
    string? ManagerName,
    string? ManagerEmail,
    string? ManagerPhone,
    bool AllowNegativeStock,
    bool IsDefault,
    bool IsActive,
    DateTime CreatedUtc,
    DateTime? UpdatedUtc);

public sealed record CreateWarehouseRequest(
    string Code,
    string Name,
    string WarehouseType,
    string? AddressLine1,
    string? AddressLine2,
    string? City,
    string? StateRegion,
    string? PostalCode,
    string? Country,
    string? ManagerName,
    string? ManagerEmail,
    string? ManagerPhone,
    bool AllowNegativeStock,
    bool IsDefault);

public sealed record UpdateWarehouseRequest(
    string Code,
    string Name,
    string WarehouseType,
    string? AddressLine1,
    string? AddressLine2,
    string? City,
    string? StateRegion,
    string? PostalCode,
    string? Country,
    string? ManagerName,
    string? ManagerEmail,
    string? ManagerPhone,
    bool AllowNegativeStock,
    bool IsDefault,
    bool IsActive);

/* ============================================================================
   Variants
   ============================================================================ */
public sealed record ProductVariantAttributeDto(string Key, string Value);

public sealed record ProductVariantDto(
    long ProductVariantId,
    long ProductId,
    string ProductName,
    string? Sku,
    string? Barcode,
    string? DisplayName,
    string? AttributeHash,
    decimal? Mrp,
    decimal? SalePrice,
    decimal? PurchasePrice,
    string? InventoryTrackingMode,
    bool IsDefault,
    string Status,
    bool IsActive,
    DateTime CreatedUtc,
    DateTime? UpdatedUtc,
    IReadOnlyList<ProductVariantAttributeDto> Attributes);

public sealed record CreateProductVariantRequest(
    long ProductId,
    string? Sku,
    string? Barcode,
    string? DisplayName,
    decimal? Mrp,
    decimal? SalePrice,
    decimal? PurchasePrice,
    string? InventoryTrackingMode,
    IReadOnlyList<ProductVariantAttributeDto> Attributes);

public sealed record UpdateProductVariantRequest(
    string? Sku,
    string? Barcode,
    string? DisplayName,
    decimal? Mrp,
    decimal? SalePrice,
    decimal? PurchasePrice,
    string? InventoryTrackingMode,
    string Status,
    bool IsActive,
    IReadOnlyList<ProductVariantAttributeDto> Attributes);

public sealed record VariantBrowseQuery(
    string? Search,
    long? ProductId,
    long? CategoryId,
    bool ActiveOnly,
    int Skip,
    int Take);

public sealed record VariantBrowseResult(IReadOnlyList<ProductVariantDto> Items, int TotalCount);

/* ============================================================================
   Inventory ledger + balance
   ============================================================================ */
public sealed record PostInventoryTransactionRequest(
    long ProductVariantId,
    long WarehouseId,
    long? BatchId,
    long? ProductSerialId,
    string TransactionType,
    string QuantityBucket,
    decimal QtyChange,
    decimal? CostPerUnit,
    string? SourceDocumentType,
    long? SourceDocumentId,
    long? SourceLineId,
    string? IdempotencyKey,
    string? Reason,
    string? MetadataJson);

public sealed record InventoryTransactionDto(
    long InventoryTransactionId,
    long ProductVariantId,
    string VariantDisplay,
    string? Sku,
    long WarehouseId,
    string WarehouseName,
    long? BatchId,
    string? BatchNumber,
    long? ProductSerialId,
    string? SerialNumber,
    string TransactionType,
    string QuantityBucket,
    decimal QtyChange,
    decimal? CostPerUnit,
    string? SourceDocumentType,
    long? SourceDocumentId,
    long? SourceLineId,
    long? ReversalOfTransactionId,
    string? Reason,
    string? CreatedBy,
    DateTime CreatedUtc);

public sealed record InventoryLedgerQuery(
    long? WarehouseId,
    long? ProductVariantId,
    long? ProductId,
    string? TransactionType,
    string? Search,
    DateTime? FromUtc,
    DateTime? ToUtc,
    int Skip,
    int Take);

public sealed record InventoryLedgerResult(IReadOnlyList<InventoryTransactionDto> Items, int TotalCount);

public sealed record InventoryBalanceDto(
    long ProductVariantId,
    string VariantDisplay,
    string? Sku,
    long ProductId,
    string ProductName,
    long WarehouseId,
    string WarehouseName,
    long? BatchId,
    string? BatchNumber,
    DateTime? ExpiryDate,
    decimal OnHandQty,
    decimal ReservedQty,
    decimal DamagedQty,
    decimal IncomingQty,
    decimal InTransitQty,
    decimal AvailableQty,
    decimal? AverageCost,
    DateTime UpdatedUtc);

public sealed record InventoryBalanceQuery(
    long? WarehouseId,
    long? ProductId,
    long? CategoryId,
    string? Search,
    bool LowStockOnly,
    int Skip,
    int Take);

public sealed record InventoryBalanceResult(IReadOnlyList<InventoryBalanceDto> Items, int TotalCount);

public sealed record InventoryDashboardDto(
    int TotalWarehouses,
    int TotalVariants,
    int TotalProducts,
    decimal TotalOnHandQty,
    decimal TotalAvailableQty,
    decimal TotalReservedQty,
    decimal InventoryValueAtCost,
    int LowStockSkuCount,
    int OutOfStockSkuCount,
    int NearExpiryBatchCount,
    int ExpiredBatchCount,
    int OpenReservationCount,
    int ActiveSerialsCount,
    IReadOnlyList<InventoryWarehouseTileDto> WarehouseTiles,
    IReadOnlyList<InventoryRecentLedgerDto> RecentLedger);

public sealed record InventoryWarehouseTileDto(
    long WarehouseId,
    string Name,
    decimal OnHandQty,
    decimal AvailableQty,
    int SkuCount);

public sealed record InventoryRecentLedgerDto(
    long InventoryTransactionId,
    DateTime CreatedUtc,
    string TransactionType,
    string VariantDisplay,
    string WarehouseName,
    decimal QtyChange,
    string? Reason);

/* ============================================================================
   Stock adjustment
   ============================================================================ */
public sealed record StockAdjustmentLineRequest(
    long ProductVariantId,
    long? BatchId,
    long? ProductSerialId,
    decimal ActualQty,
    decimal SystemQty,
    string? Reason);

public sealed record SubmitStockAdjustmentRequest(
    long WarehouseId,
    string Reason,
    string? Notes,
    bool RequireApproval,
    IReadOnlyList<StockAdjustmentLineRequest> Lines);

public sealed record StockAdjustmentResultDto(
    long? AdjustmentApprovalId,
    string? AdjustmentNumber,
    string Status,
    int PostedTransactionCount);

/* ============================================================================
   Stock transfer
   ============================================================================ */
public sealed record StockTransferLineRequest(
    long ProductVariantId,
    long? BatchId,
    decimal Quantity,
    decimal? UnitCost);

public sealed record CreateStockTransferRequest(
    long FromWarehouseId,
    long ToWarehouseId,
    DateTime? TransferDateUtc,
    string? ReferenceCode,
    string? Notes,
    IReadOnlyList<StockTransferLineRequest> Lines);

public sealed record StockTransferLineDto(
    long ProductVariantId,
    string VariantDisplay,
    string? Sku,
    long? BatchId,
    string? BatchNumber,
    decimal Quantity,
    decimal? UnitCost,
    decimal? LineValue);

public sealed record StockTransferDto(
    long StockTransferId,
    string TransferNumber,
    long FromWarehouseId,
    string FromWarehouseName,
    long ToWarehouseId,
    string ToWarehouseName,
    DateTime TransferDateUtc,
    string Status,
    int LineCount,
    decimal TotalQuantity,
    decimal? TotalValue,
    string? Notes,
    string? CreatedBy,
    DateTime CreatedUtc,
    IReadOnlyList<StockTransferLineDto> Lines);

public sealed record StockTransferSummaryDto(
    long StockTransferId,
    string TransferNumber,
    long FromWarehouseId,
    string FromWarehouseName,
    long ToWarehouseId,
    string ToWarehouseName,
    DateTime TransferDateUtc,
    string Status,
    int LineCount,
    decimal TotalQuantity,
    decimal? TotalValue);

/* ============================================================================
   Reservations
   ============================================================================ */
public sealed record CreateReservationLineRequest(
    long ProductVariantId,
    long WarehouseId,
    long? BatchId,
    long? ProductSerialId,
    decimal Quantity);

public sealed record CreateReservationRequest(
    string? ReferenceCode,
    long? CustomerId,
    string? CustomerLabel,
    DateTime? ValidUntilUtc,
    string? Notes,
    IReadOnlyList<CreateReservationLineRequest> Lines);

public sealed record ReservationLineDto(
    long InventoryReservationLineId,
    long ProductVariantId,
    string VariantDisplay,
    string? Sku,
    long WarehouseId,
    string WarehouseName,
    long? BatchId,
    string? BatchNumber,
    long? ProductSerialId,
    string? SerialNumber,
    decimal Quantity,
    string Status);

public sealed record ReservationDto(
    long InventoryReservationId,
    string? ReferenceCode,
    long? CustomerId,
    string? CustomerLabel,
    DateTime ReservationDateUtc,
    DateTime? ValidUntilUtc,
    string Status,
    string? Notes,
    string? CreatedBy,
    DateTime CreatedUtc,
    DateTime? UpdatedUtc,
    decimal TotalQuantity,
    IReadOnlyList<ReservationLineDto> Lines);

public sealed record ReservationSummaryDto(
    long InventoryReservationId,
    string? ReferenceCode,
    long? CustomerId,
    string? CustomerLabel,
    DateTime ReservationDateUtc,
    DateTime? ValidUntilUtc,
    string Status,
    int LineCount,
    decimal TotalQuantity);

/* ============================================================================
   Batches & serials
   ============================================================================ */
public sealed record BatchDto(
    long BatchId,
    long ProductVariantId,
    string VariantDisplay,
    string? Sku,
    string BatchNumber,
    string? LotNumber,
    DateTime? ManufacturingDate,
    DateTime? ExpiryDate,
    string QualityStatus,
    decimal? CostPerUnit,
    long? SupplierPartyId,
    string? SupplierName,
    string? Notes,
    bool IsActive,
    DateTime CreatedUtc);

public sealed record CreateBatchRequest(
    long ProductVariantId,
    string BatchNumber,
    string? LotNumber,
    DateTime? ManufacturingDate,
    DateTime? ExpiryDate,
    string QualityStatus,
    decimal? CostPerUnit,
    long? SupplierPartyId,
    string? Notes);

public sealed record BatchBrowseQuery(
    long? ProductVariantId,
    string? Search,
    string? QualityStatus,
    DateTime? ExpiryBeforeUtc,
    int Skip,
    int Take);

public sealed record BatchBrowseResult(IReadOnlyList<BatchDto> Items, int TotalCount);

public sealed record ProductSerialDto(
    long ProductSerialId,
    long ProductVariantId,
    string VariantDisplay,
    string? Sku,
    string SerialNumber,
    string? Imei1,
    string? Imei2,
    long? WarehouseId,
    string? WarehouseName,
    long? BatchId,
    string? BatchNumber,
    decimal? PurchaseCostPerUnit,
    string Status,
    long? SoldInvoiceLineId,
    DateTime? WarrantyStartUtc,
    DateTime? WarrantyEndUtc,
    string? Notes,
    DateTime CreatedUtc);

public sealed record CreateProductSerialRequest(
    long ProductVariantId,
    string SerialNumber,
    string? Imei1,
    string? Imei2,
    long? WarehouseId,
    long? BatchId,
    decimal? PurchaseCostPerUnit,
    DateTime? WarrantyStartUtc,
    DateTime? WarrantyEndUtc,
    string? Notes);

public sealed record SerialBrowseQuery(
    long? ProductId,
    long? ProductVariantId,
    long? WarehouseId,
    string? Status,
    string? Search,
    int Skip,
    int Take);

public sealed record SerialBrowseResult(IReadOnlyList<ProductSerialDto> Items, int TotalCount);

/* ============================================================================
   Returns / RMA
   ============================================================================ */
public sealed record ReturnLineRequest(
    long? ProductVariantId,
    long? ProductSerialId,
    long? BatchId,
    decimal Quantity,
    decimal? UnitRefundAmount,
    string? Reason,
    string? Disposition,
    string? Notes);

public sealed record CreateReturnRequest(
    string ReturnType,                  // CustomerReturn | SupplierReturn | Exchange | WarrantyClaim
    string? SourceDocumentType,
    long? SourceDocumentId,
    long? PartyId,
    long? WarehouseId,
    string? Reason,
    string? Notes,
    IReadOnlyList<ReturnLineRequest> Lines);

public sealed record ReturnLineDto(
    long ReturnLineId,
    long? ProductVariantId,
    string? VariantDisplay,
    string? Sku,
    long? ProductSerialId,
    string? SerialNumber,
    long? BatchId,
    string? BatchNumber,
    decimal Quantity,
    decimal? UnitRefundAmount,
    decimal? LineRefundAmount,
    string? Reason,
    string? Disposition,
    string? InspectionResult,
    string? Notes);

public sealed record ReturnDto(
    long ReturnAuthorizationId,
    string? ReturnNumber,
    string ReturnType,
    string? SourceDocumentType,
    long? SourceDocumentId,
    long? PartyId,
    string? PartyName,
    long? WarehouseId,
    string? WarehouseName,
    string? Reason,
    string Status,
    decimal? TotalRefundAmount,
    string? Notes,
    DateTime RequestedUtc,
    DateTime? ApprovedUtc,
    DateTime? ReceivedUtc,
    DateTime? InspectedUtc,
    DateTime? CompletedUtc,
    string? CreatedBy,
    IReadOnlyList<ReturnLineDto> Lines);

public sealed record ReturnSummaryDto(
    long ReturnAuthorizationId,
    string? ReturnNumber,
    string ReturnType,
    string Status,
    string? PartyName,
    string? WarehouseName,
    DateTime RequestedUtc,
    int LineCount,
    decimal TotalQuantity,
    decimal? TotalRefundAmount);

public sealed record ReturnBrowseQuery(
    string? ReturnType,
    string? Status,
    string? Search,
    DateTime? FromUtc,
    DateTime? ToUtc,
    int Skip,
    int Take);

public sealed record ReturnBrowseResult(IReadOnlyList<ReturnSummaryDto> Items, int TotalCount);

/* ============================================================================
   Reports
   ============================================================================ */
public sealed record StockSummaryReportRow(
    long ProductId,
    long ProductVariantId,
    string ProductName,
    string? Sku,
    string? CategoryName,
    string? WarehouseName,
    long? WarehouseId,
    decimal OnHandQty,
    decimal ReservedQty,
    decimal AvailableQty,
    decimal DamagedQty,
    decimal? AverageCost,
    decimal InventoryValueAtCost,
    string? StockStatus);

public sealed record StockSummaryReport(
    IReadOnlyList<StockSummaryReportRow> Rows,
    decimal TotalOnHandValue,
    int TotalSkus,
    int InStockCount,
    int LowStockCount,
    int OutOfStockCount);

public sealed record LowStockReportRow(
    long ProductId,
    long ProductVariantId,
    string ProductName,
    string? Sku,
    string? CategoryName,
    long? WarehouseId,
    string? WarehouseName,
    decimal AvailableQty,
    decimal? LowStockThreshold,
    string Severity);

public sealed record ExpiryFefoReportRow(
    long BatchId,
    long ProductVariantId,
    string ProductName,
    string? Sku,
    string BatchNumber,
    string? WarehouseName,
    DateTime? ExpiryDate,
    int? DaysToExpiry,
    string ExpiryStatus,
    decimal OnHandQty,
    decimal? UnitCost,
    decimal? TotalValueAtRisk);

public sealed record SerialTraceReportRow(
    long ProductSerialId,
    string SerialNumber,
    string ProductName,
    string? Sku,
    string Status,
    long? PurchaseLineId,
    long? PurchaseBillId,
    string? PurchaseInvoiceNumber,
    DateTime? PurchaseDateUtc,
    decimal? PurchaseCostPerUnit,
    long? SoldInvoiceLineId,
    long? SoldInvoiceId,
    string? SoldInvoiceNumber,
    DateTime? SoldDateUtc,
    decimal? SellingPrice,
    decimal? GrossProfit,
    string? WarehouseName);

public sealed record ItemProfitReportRow(
    long ProductId,
    long ProductVariantId,
    string ProductName,
    string? Sku,
    decimal QuantitySold,
    decimal TotalRevenue,
    decimal TotalCost,
    decimal GrossProfit,
    decimal GrossMarginPercent);

public sealed record InventoryValuationReportRow(
    long ProductId,
    long ProductVariantId,
    string ProductName,
    string? Sku,
    string? CategoryName,
    long? WarehouseId,
    string? WarehouseName,
    decimal OnHandQty,
    decimal? AverageCost,
    decimal? TotalValue,
    int? AgeDays,
    string? AgeBucket);
