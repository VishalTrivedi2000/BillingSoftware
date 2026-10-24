using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IProductImageRepository
{
    Task<IReadOnlyList<ProductImageDto>> ListAsync(long productId, CancellationToken ct);
    Task<string?> GetRelativePathAsync(long productId, long imageId, CancellationToken ct);
    Task<long> InsertAsync(long productId, string relativePath, string contentType, bool makePrimary, CancellationToken ct);
    Task<bool> DeleteAsync(long productId, long imageId, CancellationToken ct);
    Task<bool> SetPrimaryAsync(long productId, long imageId, CancellationToken ct);
}
