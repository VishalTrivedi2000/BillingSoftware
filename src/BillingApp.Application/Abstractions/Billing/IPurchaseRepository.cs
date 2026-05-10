using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IPurchaseRepository
{
    Task<long> CreateAsync(CreatePurchaseBillRequest request, CancellationToken ct);
    Task<IReadOnlyList<PurchaseBillSummaryDto>> ListAsync(int skip, int take, CancellationToken ct);
    Task<PurchaseBillDetailDto?> GetDetailAsync(long purchaseBillId, CancellationToken ct);
}
