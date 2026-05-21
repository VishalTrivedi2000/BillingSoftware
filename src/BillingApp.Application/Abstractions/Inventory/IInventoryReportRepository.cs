using BillingApp.Application.Inventory;

namespace BillingApp.Application.Abstractions.Inventory;

public interface IInventoryReportRepository
{
    Task<StockSummaryReport> StockSummaryAsync(long? warehouseId, long? categoryId, string? search, CancellationToken ct);
    Task<IReadOnlyList<LowStockReportRow>> LowStockAsync(long? warehouseId, CancellationToken ct);
    Task<IReadOnlyList<ExpiryFefoReportRow>> ExpiryFefoAsync(long? warehouseId, int? daysWindow, CancellationToken ct);
    Task<IReadOnlyList<SerialTraceReportRow>> SerialTraceAsync(string? search, long? productVariantId, string? status, CancellationToken ct);
    Task<IReadOnlyList<ItemProfitReportRow>> ItemProfitAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct);
    Task<IReadOnlyList<InventoryValuationReportRow>> ValuationAsync(long? warehouseId, long? categoryId, string costingMethod, CancellationToken ct);
}
