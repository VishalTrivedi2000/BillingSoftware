namespace BillingApp.Application.Billing;

public sealed record DashboardMetricsDto(
    int CustomerCount,
    int ActiveProductCount,
    int InvoiceCount,
    decimal TotalInvoicedAmount);

public sealed record CustomerDto(long CustomerId, string Name, string? TaxId, string? Email, string? Phone, DateTime CreatedUtc);

public sealed record CreateCustomerRequest(string Name, string? TaxId, string? Email, string? Phone);

public sealed record UpdateCustomerRequest(string Name, string? TaxId, string? Email, string? Phone);

public sealed record ProductDto(long ProductId, string? Sku, string Name, decimal UnitPrice, bool IsActive, DateTime CreatedUtc);

public sealed record CreateProductRequest(string? Sku, string Name, decimal UnitPrice);

public sealed record UpdateProductRequest(string? Sku, string Name, decimal UnitPrice, bool IsActive);

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
    string Status);

public sealed record InvoiceDetailDto(
    long InvoiceId,
    string? InvoiceNumber,
    long CustomerId,
    string CustomerName,
    DateTime IssueUtc,
    string Currency,
    decimal TotalAmount,
    string Status,
    IReadOnlyList<InvoiceLineDto> Lines);

public sealed record CreateInvoiceLineRequest(long? ProductId, string Description, decimal Quantity, decimal UnitPrice);

public sealed record CreateInvoiceRequest(long CustomerId, IReadOnlyList<CreateInvoiceLineRequest> Lines);
