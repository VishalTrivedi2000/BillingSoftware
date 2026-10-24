using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IProductUnitRepository
{
    Task<IReadOnlyList<ProductUnitDto>> ListAsync(CancellationToken ct);
    Task<ProductUnitDto?> GetAsync(long unitId, CancellationToken ct);
    Task<bool> CodeTakenAsync(string code, long? exceptUnitId, CancellationToken ct);
    Task<long> CreateAsync(CreateProductUnitRequest request, CancellationToken ct);
    Task<bool> UpdateAsync(long unitId, UpdateProductUnitRequest request, CancellationToken ct);
}
