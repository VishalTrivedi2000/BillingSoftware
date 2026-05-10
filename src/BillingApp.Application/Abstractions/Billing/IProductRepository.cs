using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IProductRepository
{
    Task<long> CreateAsync(CreateProductRequest request, CancellationToken ct);
    Task<IReadOnlyList<ProductDto>> ListAsync(bool activeOnly, int maxRows, CancellationToken ct);
    Task<ProductDto?> GetAsync(long productId, CancellationToken ct);
    Task<bool> UpdateAsync(long productId, UpdateProductRequest request, CancellationToken ct);
    Task<ProductBrowseResult> BrowseAsync(ProductBrowseQuery query, CancellationToken ct);
    Task<ProductInventorySummaryDto> GetInventorySummaryAsync(CancellationToken ct);
}
