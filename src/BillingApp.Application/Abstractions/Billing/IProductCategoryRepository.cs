using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IProductCategoryRepository
{
    Task<IReadOnlyList<ProductCategoryDto>> ListAsync(CancellationToken ct);
    Task<ProductCategoryDto?> GetAsync(long categoryId, CancellationToken ct);
    Task<bool> SlugTakenAsync(string slug, long? exceptCategoryId, CancellationToken ct);
    Task<long> CreateAsync(CreateProductCategoryRequest request, CancellationToken ct);
    Task<bool> UpdateAsync(long categoryId, UpdateProductCategoryRequest request, CancellationToken ct);
}
