using System.Data.Common;
using BillingApp.Application.Abstractions.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
public sealed class HealthController : ControllerBase
{
    private readonly IDbConnectionFactory _connectionFactory;

    public HealthController(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    /// <summary>Unauthenticated readiness probe (SPA dashboard + ops); SQL check only — no JWT required.</summary>
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<object>> Get(CancellationToken cancellationToken)
    {
        await using DbConnection db = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        return Ok(new { status = "ok", sql = "connected" });
    }
}
