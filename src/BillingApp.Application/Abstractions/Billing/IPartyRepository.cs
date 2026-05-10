using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IPartyRepository
{
    Task<long> CreateAsync(CreatePartyRequest request, CancellationToken ct);
    Task<IReadOnlyList<PartyDto>> ListAsync(int maxRows, CancellationToken ct);
    Task<PartyDto?> GetAsync(long partyId, CancellationToken ct);
    Task<bool> UpdateAsync(long partyId, UpdatePartyRequest request, CancellationToken ct);
}
