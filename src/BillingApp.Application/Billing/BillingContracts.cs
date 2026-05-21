namespace BillingApp.Application.Billing;

public sealed record DashboardMetricsDto(
    int CustomerCount,
    int ActiveProductCount,
    int InvoiceCount,
    decimal TotalInvoicedAmount);

/// <summary>Receivables-oriented aggregates for the sales workspace (posted/settled invoices + receipts).</summary>
public sealed record SalesSummaryDto(
    int PostedInvoiceCount,
    decimal TotalInvoicedAmount,
    decimal TotalCollectedAmount,
    decimal TotalOutstandingAmount);

public sealed record CustomerDto(long CustomerId, string Name, string? TaxId, string? Email, string? Phone, DateTime CreatedUtc);

public sealed record CreateCustomerRequest(string Name, string? TaxId, string? Email, string? Phone);

public sealed record UpdateCustomerRequest(string Name, string? TaxId, string? Email, string? Phone);

public static class PartyKinds
{
    public const string Customer = "Customer";
    public const string Vendor = "Vendor";
    public const string Other = "Other";

    public static string Normalize(string? kind)
    {
        if (string.IsNullOrWhiteSpace(kind))
            return Customer;
        if (string.Equals(kind.Trim(), Customer, StringComparison.OrdinalIgnoreCase))
            return Customer;
        if (string.Equals(kind.Trim(), Vendor, StringComparison.OrdinalIgnoreCase))
            return Vendor;
        if (string.Equals(kind.Trim(), Other, StringComparison.OrdinalIgnoreCase))
            return Other;
        return string.Empty;
    }
}

public sealed record PartyDto(
    long PartyId,
    string Kind,
    string DisplayName,
    string? LegalName,
    string? TaxId,
    string? Email,
    string? Phone,
    string? Notes,
    bool IsActive,
    DateTime CreatedUtc);

public sealed record CreatePartyRequest(
    string Kind,
    string DisplayName,
    string? LegalName,
    string? TaxId,
    string? Email,
    string? Phone,
    string? Notes);

public sealed record UpdatePartyRequest(
    string Kind,
    string DisplayName,
    string? LegalName,
    string? TaxId,
    string? Email,
    string? Phone,
    string? Notes,
    bool IsActive);

public sealed record ProductCategoryDto(
    long CategoryId,
    long? ParentCategoryId,
    string Slug,
    string Name,
    int SortOrder,
    bool IsActive);

public sealed record CreateProductCategoryRequest(long? ParentCategoryId, string Slug, string Name, int SortOrder);

public sealed record UpdateProductCategoryRequest(long? ParentCategoryId, string Slug, string Name, int SortOrder, bool IsActive);

public sealed record ProductBrandDto(long BrandId, string Slug, string Name, int SortOrder, bool IsActive);

public sealed record CreateProductBrandRequest(string Slug, string Name, int SortOrder);

public sealed record UpdateProductBrandRequest(string Slug, string Name, int SortOrder, bool IsActive);

public sealed record ProductUnitDto(long UnitId, string Code, string DisplayName, int SortOrder, bool IsActive);

public sealed record CreateProductUnitRequest(string Code, string DisplayName, int SortOrder);

public sealed record UpdateProductUnitRequest(string Code, string DisplayName, int SortOrder, bool IsActive);

public sealed record ProductDto(
    long ProductId,
    string? Sku,
    string Name,
    string? Brand,
    long? BrandId,
    decimal UnitPrice,
    decimal StockQty,
    decimal? LowStockThreshold,
    long? CategoryId,
    string? CategoryName,
    long? UnitId,
    string? UnitName,
    bool IsActive,
    string? PrimaryImageRelativePath,
    DateTime CreatedUtc,
    string? HsnCode,
    string? Description,
    decimal? Mrp,
    decimal? PurchasePrice,
    decimal? WholesalePrice,
    decimal? MinWholesaleQty,
    decimal? TaxRatePercent,
    string? StorageLocation,
    bool IsService,
    string? Tags = null,
    string? Manufacturer = null,
    string? Barcode = null,
    string? CountryOfOrigin = null,
    string? InternalCode = null,
    string? ManufacturerPartNo = null,
    string? Visibility = null,
    string? InventoryTrackingMode = null,
    string? ProductNature = null,
    bool HasVariants = false,
    bool AllowNegativeStock = false,
    int? LeadTimeDays = null,
    int? WarrantyMonths = null,
    int? ShelfLifeDays = null,
    bool IsReturnable = true,
    decimal? ReorderQty = null,
    decimal? MaxStock = null,
    bool LowStockAlert = true);

public sealed record ProductImageDto(
    long ProductImageId,
    string RelativePath,
    string ContentType,
    int SortOrder,
    bool IsPrimary,
    DateTime CreatedUtc);

public sealed record CreateProductRequest(
    string? Sku,
    string Name,
    string? Brand,
    decimal UnitPrice,
    long? CategoryId,
    long? BrandId,
    long? UnitId,
    decimal? StockQty,
    decimal? LowStockThreshold,
    string? HsnCode,
    string? Description,
    decimal? Mrp,
    decimal? PurchasePrice,
    decimal? WholesalePrice,
    decimal? MinWholesaleQty,
    decimal? TaxRatePercent,
    string? StorageLocation,
    bool IsService,
    string? Tags = null,
    string? Manufacturer = null,
    string? Barcode = null,
    string? CountryOfOrigin = null,
    string? InternalCode = null,
    string? ManufacturerPartNo = null,
    string? Visibility = null,
    string? InventoryTrackingMode = null,
    string? ProductNature = null,
    bool AllowNegativeStock = false,
    int? LeadTimeDays = null,
    int? WarrantyMonths = null,
    int? ShelfLifeDays = null,
    bool IsReturnable = true,
    decimal? ReorderQty = null,
    decimal? MaxStock = null,
    bool LowStockAlert = true);

public sealed record UpdateProductRequest(
    string? Sku,
    string Name,
    string? Brand,
    long? BrandId,
    long? UnitId,
    decimal UnitPrice,
    long? CategoryId,
    decimal StockQty,
    decimal? LowStockThreshold,
    bool IsActive,
    string? HsnCode,
    string? Description,
    decimal? Mrp,
    decimal? PurchasePrice,
    decimal? WholesalePrice,
    decimal? MinWholesaleQty,
    decimal? TaxRatePercent,
    string? StorageLocation,
    bool IsService,
    string? Tags = null,
    string? Manufacturer = null,
    string? Barcode = null,
    string? CountryOfOrigin = null,
    string? InternalCode = null,
    string? ManufacturerPartNo = null,
    string? Visibility = null,
    string? InventoryTrackingMode = null,
    string? ProductNature = null,
    bool AllowNegativeStock = false,
    int? LeadTimeDays = null,
    int? WarrantyMonths = null,
    int? ShelfLifeDays = null,
    bool IsReturnable = true,
    decimal? ReorderQty = null,
    decimal? MaxStock = null,
    bool LowStockAlert = true);

public sealed record ProductBrowseQuery(
    string? Search,
    long? CategoryId,
    long? BrandId,
    long? UnitId,
    bool ActiveOnly,
    string Sort,
    int Skip,
    int Take,
    bool AlertsOnly);

public sealed record ProductBrowseResult(IReadOnlyList<ProductDto> Items, int TotalCount);

public sealed record ProductInventorySummaryDto(
    int TotalSkus,
    int ActiveSkus,
    int OutOfStockCount,
    int LowStockAlertCount,
    decimal InventoryValueAtRetail);

public sealed record InvoiceLineDto(
    long InvoiceLineId,
    long? ProductId,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal);

public sealed record InvoiceSummaryDto(
    long InvoiceId,
    string? InvoiceNumber,
    long CustomerId,
    string CustomerName,
    DateTime IssueUtc,
    decimal TotalAmount,
    string Status,
    decimal AmountPaid,
    decimal BalanceDue,
    string? LastPaymentChannel);

public sealed record InvoicePaymentEntryDto(
    long InvoicePaymentId,
    decimal Amount,
    DateTime ReceivedUtc,
    string? Channel,
    string? ReferenceNote);

public sealed record InvoiceDetailDto(
    long InvoiceId,
    string? InvoiceNumber,
    long CustomerId,
    string CustomerName,
    DateTime IssueUtc,
    string Currency,
    decimal TotalAmount,
    string Status,
    IReadOnlyList<InvoiceLineDto> Lines,
    decimal AmountPaid,
    decimal BalanceDue,
    IReadOnlyList<InvoicePaymentEntryDto> Payments);

public sealed record RecordInvoicePaymentRequest(decimal Amount, DateTime? ReceivedUtc, string? Channel, string? ReferenceNote);

public sealed record CreateInvoiceLineRequest(
    long? ProductId,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    long? ProductVariantId = null,
    IReadOnlyList<long>? ProductSerialIds = null);

public sealed record CreateInvoiceRequest(long CustomerId, IReadOnlyList<CreateInvoiceLineRequest> Lines);

public sealed record PurchaseLineDto(
    long PurchaseLineId,
    long? ProductId,
    string Description,
    decimal Quantity,
    decimal UnitCost,
    decimal DiscountPercent,
    decimal DiscountAmount,
    decimal TaxRatePercent,
    decimal TaxableAmount,
    decimal TaxAmount,
    decimal LineTotal);

public sealed record PurchaseBillSummaryDto(
    long PurchaseBillId,
    string? PurchaseNumber,
    long PartyId,
    string SupplierName,
    DateTime ReceivedUtc,
    decimal TotalAmount,
    string Status,
    decimal AmountPaid,
    decimal BalanceDue);

public sealed record PurchaseBillDetailDto(
    long PurchaseBillId,
    string? PurchaseNumber,
    long PartyId,
    string SupplierName,
    DateTime ReceivedUtc,
    string Currency,
    decimal TotalAmount,
    string Status,
    IReadOnlyList<PurchaseLineDto> Lines);

public sealed record CreatePurchaseLineRequest(
    long? ProductId,
    string Description,
    decimal Quantity,
    decimal UnitCost,
    decimal DiscountPercent,
    decimal DiscountAmount,
    decimal TaxRatePercent);

public sealed record CreatePurchaseBillRequest(long PartyId, IReadOnlyList<CreatePurchaseLineRequest> Lines);
