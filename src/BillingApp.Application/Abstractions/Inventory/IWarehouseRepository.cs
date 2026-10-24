using BillingApp.Application.Inventory;

namespace BillingApp.Application.Abstractions.Inventory;

public interface IWarehouseRepository
{
    Task<IReadOnlyList<WarehouseDto>> ListAsync(bool activeOnly, CancellationToken ct);
    Task<WarehouseDto?> GetAsync(long warehouseId, CancellationToken ct);
    Task<long> CreateAsync(CreateWarehouseRequest request, CancellationToken ct);
    Task<bool> UpdateAsync(long warehouseId, UpdateWarehouseRequest request, CancellationToken ct);
    Task<bool> SoftDeleteAsync(long warehouseId, CancellationToken ct);
    Task<long?> EnsureDefaultWarehouseIdAsync(CancellationToken ct);
}
