using BillingApp.Application.Billing;

namespace BillingApp.Application.Abstractions.Billing;

public interface IDashboardMetricsRepository
{
    Task<DashboardMetricsDto> GetAsync(CancellationToken ct);
}
