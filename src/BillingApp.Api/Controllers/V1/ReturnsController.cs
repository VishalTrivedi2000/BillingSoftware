using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Inventory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/returns")]
public sealed class ReturnsController : ControllerBase
{
    private readonly IReturnRepository _returns;

    public ReturnsController(IReturnRepository returns)
    {
        _returns = returns;
    }

    [HttpGet]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<ReturnBrowseResult>> Browse(
        [FromQuery] string? returnType,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var dto = await _returns.BrowseAsync(new ReturnBrowseQuery(
            string.IsNullOrWhiteSpace(returnType) ? null : returnType.Trim(),
            string.IsNullOrWhiteSpace(status) ? null : status.Trim(),
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            fromUtc, toUtc,
            Math.Max(0, skip), Math.Clamp(take, 1, 500)), ct).ConfigureAwait(false);
        return Ok(dto);
    }

    [HttpGet("{returnAuthorizationId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<ReturnDto>> Get(long returnAuthorizationId, CancellationToken ct)
    {
        var row = await _returns.GetAsync(returnAuthorizationId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryReturn)]
    public async Task<ActionResult<object>> Create([FromBody] CreateReturnRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _returns.CreateAsync(request, User?.Identity?.Name, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { returnAuthorizationId = id }, new { returnAuthorizationId = id });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{returnAuthorizationId:long}/approve")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryReturn)]
    public async Task<IActionResult> Approve(long returnAuthorizationId, CancellationToken ct)
    {
        var ok = await _returns.ApproveAsync(returnAuthorizationId, User?.Identity?.Name, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{returnAuthorizationId:long}/receive")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryReturn)]
    public async Task<IActionResult> Receive(long returnAuthorizationId, CancellationToken ct)
    {
        var ok = await _returns.ReceiveAsync(returnAuthorizationId, User?.Identity?.Name, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{returnAuthorizationId:long}/inspect-complete")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryReturn)]
    public async Task<IActionResult> InspectAndComplete(long returnAuthorizationId, CancellationToken ct)
    {
        try
        {
            var ok = await _returns.InspectAndCompleteAsync(returnAuthorizationId, User?.Identity?.Name, ct).ConfigureAwait(false);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
