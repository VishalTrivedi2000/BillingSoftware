using BillingApp.Application.Inventory;

namespace BillingApp.Application.Abstractions.Inventory;

public interface IBatchRepository
{
    Task<long> CreateAsync(CreateBatchRequest request, CancellationToken ct);
    Task<BatchDto?> GetAsync(long batchId, CancellationToken ct);
    Task<BatchBrowseResult> BrowseAsync(BatchBrowseQuery query, CancellationToken ct);
}

public interface IProductSerialRepository
{
    Task<long> CreateAsync(CreateProductSerialRequest request, CancellationToken ct);
    Task<ProductSerialDto?> GetAsync(long productSerialId, CancellationToken ct);
    Task<SerialBrowseResult> BrowseAsync(SerialBrowseQuery query, CancellationToken ct);
}
