using BillingApp.Application.Inventory;

namespace BillingApp.Application.Abstractions.Inventory;

public interface IReturnRepository
{
    Task<long> CreateAsync(CreateReturnRequest request, string? actor, CancellationToken ct);
    Task<ReturnDto?> GetAsync(long returnAuthorizationId, CancellationToken ct);
    Task<ReturnBrowseResult> BrowseAsync(ReturnBrowseQuery query, CancellationToken ct);
    Task<bool> ApproveAsync(long returnAuthorizationId, string? actor, CancellationToken ct);
    Task<bool> ReceiveAsync(long returnAuthorizationId, string? actor, CancellationToken ct);
    Task<bool> InspectAndCompleteAsync(long returnAuthorizationId, string? actor, CancellationToken ct);
}
