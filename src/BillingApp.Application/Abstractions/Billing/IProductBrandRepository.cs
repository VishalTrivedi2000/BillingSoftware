using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IProductBrandRepository
{
    Task<IReadOnlyList<ProductBrandDto>> ListAsync(CancellationToken ct);
    Task<ProductBrandDto?> GetAsync(long brandId, CancellationToken ct);
    Task<string?> GetNameAsync(long brandId, CancellationToken ct);
    Task<bool> SlugTakenAsync(string slug, long? exceptBrandId, CancellationToken ct);
    Task<long> CreateAsync(CreateProductBrandRequest request, CancellationToken ct);
    Task<bool> UpdateAsync(long brandId, UpdateProductBrandRequest request, CancellationToken ct);
}
