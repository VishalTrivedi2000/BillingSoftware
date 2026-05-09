using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface ICustomerRepository
{
    Task<long> CreateAsync(CreateCustomerRequest request, CancellationToken ct);
    Task<IReadOnlyList<CustomerDto>> ListAsync(int maxRows, CancellationToken ct);
    Task<CustomerDto?> GetAsync(long customerId, CancellationToken ct);
    Task<bool> UpdateAsync(long customerId, UpdateCustomerRequest request, CancellationToken ct);
}
