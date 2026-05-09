using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize(Policy = "perm:" + PermissionNames.InvoicesRead)]
[Route("api/v1/dashboard")]
public sealed class DashboardController : ControllerBase
{
    private readonly IDashboardMetricsRepository _metrics;

    public DashboardController(IDashboardMetricsRepository metrics) => _metrics = metrics;

    [HttpGet("metrics")]
    public async Task<ActionResult<DashboardMetricsDto>> GetMetrics(CancellationToken ct)
    {
        var dto = await _metrics.GetAsync(ct).ConfigureAwait(false);
        return Ok(dto);
    }
}
