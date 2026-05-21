using BillingApp.Application.Inventory;

namespace BillingApp.Application.Abstractions.Inventory;

public interface IInventoryRepository
{
    Task<long> PostTransactionAsync(PostInventoryTransactionRequest request, CancellationToken ct);
    Task<InventoryLedgerResult> LedgerAsync(InventoryLedgerQuery query, CancellationToken ct);
    Task<InventoryTransactionDto?> GetTransactionAsync(long inventoryTransactionId, CancellationToken ct);
    Task<InventoryBalanceResult> BalancesAsync(InventoryBalanceQuery query, CancellationToken ct);
    Task<InventoryDashboardDto> GetDashboardAsync(CancellationToken ct);

    Task<StockAdjustmentResultDto> SubmitAdjustmentAsync(SubmitStockAdjustmentRequest request, string? actor, CancellationToken ct);
    Task<bool> ApproveAdjustmentAsync(long adjustmentApprovalId, string? actor, CancellationToken ct);
}
