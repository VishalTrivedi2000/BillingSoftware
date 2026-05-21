using BillingApp.Application.Inventory;

namespace BillingApp.Application.Abstractions.Inventory;

public interface IStockTransferRepository
{
    Task<long> CreateAsync(CreateStockTransferRequest request, string? actor, CancellationToken ct);
    Task<StockTransferDto?> GetAsync(long stockTransferId, CancellationToken ct);
    Task<IReadOnlyList<StockTransferSummaryDto>> ListAsync(string? status, int skip, int take, CancellationToken ct);
}
