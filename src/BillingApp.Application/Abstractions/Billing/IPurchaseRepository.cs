using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IPurchaseRepository
{
    Task<long> CreateAsync(CreatePurchaseBillRequest request, CancellationToken ct);

    /// <summary>Creates a draft bill with lines; does not affect inventory.</summary>
    Task<long> CreateDraftAsync(CreatePurchaseBillRequest request, CancellationToken ct);

    /// <summary>Replaces lines on a draft bill and updates totals; does not affect inventory.</summary>
    Task<bool> UpdateDraftAsync(long purchaseBillId, CreatePurchaseBillRequest request, CancellationToken ct);

    /// <summary>Posts a draft: bumps stock like a posted purchase and assigns PUR number.</summary>
    Task<bool> PostDraftAsync(long purchaseBillId, CancellationToken ct);

    Task<IReadOnlyList<PurchaseBillSummaryDto>> ListAsync(int skip, int take, string? statusFilter, DateTime? receivedFromUtc, DateTime? receivedToUtcExclusive, CancellationToken ct);

    Task<PurchaseBillDetailDto?> GetDetailAsync(long purchaseBillId, CancellationToken ct);
}
