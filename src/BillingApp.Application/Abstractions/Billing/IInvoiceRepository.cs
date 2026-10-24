using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IInvoiceRepository
{
    Task<long> CreateAsync(CreateInvoiceRequest request, CancellationToken ct);
    Task<IReadOnlyList<InvoiceSummaryDto>> ListAsync(int skip, int take, DateTime? issueFromUtc, DateTime? issueToUtcExclusive, CancellationToken ct);
    Task<InvoiceDetailDto?> GetDetailAsync(long invoiceId, CancellationToken ct);
    Task<long> RecordPaymentAsync(long invoiceId, RecordInvoicePaymentRequest request, CancellationToken ct);

    /// <summary>Tenant/org scoped aggregates across invoices and invoice payments.</summary>
    Task<SalesSummaryDto> GetSalesSummaryAsync(CancellationToken ct);
}
