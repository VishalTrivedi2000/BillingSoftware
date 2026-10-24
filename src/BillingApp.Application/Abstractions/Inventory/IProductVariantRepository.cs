using BillingApp.Application.Inventory;

namespace BillingApp.Application.Abstractions.Inventory;

public interface IProductVariantRepository
{
    Task<ProductVariantDto?> GetAsync(long productVariantId, CancellationToken ct);
    Task<IReadOnlyList<ProductVariantDto>> ListByProductAsync(long productId, bool activeOnly, CancellationToken ct);
    Task<VariantBrowseResult> BrowseAsync(VariantBrowseQuery query, CancellationToken ct);
    Task<long> CreateAsync(CreateProductVariantRequest request, CancellationToken ct);
    Task<bool> UpdateAsync(long productVariantId, UpdateProductVariantRequest request, CancellationToken ct);
    Task<bool> SoftDeleteAsync(long productVariantId, CancellationToken ct);
    Task<long> EnsureDefaultVariantAsync(long productId, CancellationToken ct);
}
