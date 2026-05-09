using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IInvoiceRepository
{
    Task<long> CreateAsync(CreateInvoiceRequest request, CancellationToken ct);
    Task<IReadOnlyList<InvoiceSummaryDto>> ListAsync(int skip, int take, CancellationToken ct);
    Task<InvoiceDetailDto?> GetDetailAsync(long invoiceId, CancellationToken ct);
}
