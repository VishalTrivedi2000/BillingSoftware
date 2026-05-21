using BillingApp.Application.Inventory;

namespace BillingApp.Application.Abstractions.Inventory;

public interface IInventoryReservationRepository
{
    Task<long> CreateAsync(CreateReservationRequest request, string? actor, CancellationToken ct);
    Task<ReservationDto?> GetAsync(long reservationId, CancellationToken ct);
    Task<IReadOnlyList<ReservationSummaryDto>> ListAsync(string? status, int skip, int take, CancellationToken ct);
    Task<bool> ReleaseAsync(long reservationId, string? actor, CancellationToken ct);
    Task<bool> ExpireDueAsync(CancellationToken ct);
}
