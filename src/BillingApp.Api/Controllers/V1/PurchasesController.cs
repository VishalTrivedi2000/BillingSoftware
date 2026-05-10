using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/purchases")]
public sealed class PurchasesController : ControllerBase
{
    private readonly IPurchaseRepository _purchases;

    public PurchasesController(IPurchaseRepository purchases) => _purchases = purchases;

    [HttpGet]
    [Authorize(Policy = "perm:" + PermissionNames.PurchasesRead)]
    public async Task<ActionResult<IReadOnlyList<PurchaseBillSummaryDto>>> List(
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        [FromQuery] string? status = null,
        [FromQuery] DateOnly? receivedFrom = null,
        [FromQuery] DateOnly? receivedTo = null,
        CancellationToken ct = default)
    {
        string? normalized = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim();
            if (!string.Equals(s, "Draft", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(s, "Posted", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("status must be Draft or Posted when supplied.");
            }

            normalized = string.Equals(s, "Draft", StringComparison.OrdinalIgnoreCase) ? "Draft" : "Posted";
        }

        DateTime? receivedFromUtc = receivedFrom is null
            ? null
            : DateTime.SpecifyKind(receivedFrom.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        DateTime? receivedToUtcExclusive = receivedTo is null
            ? null
            : DateTime.SpecifyKind(receivedTo.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

        var rows = await _purchases.ListAsync(Math.Max(0, skip), Math.Clamp(take, 1, 500), normalized, receivedFromUtc, receivedToUtcExclusive, ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{purchaseBillId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.PurchasesRead)]
    public async Task<ActionResult<PurchaseBillDetailDto>> Get(long purchaseBillId, CancellationToken ct)
    {
        var row = await _purchases.GetDetailAsync(purchaseBillId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = "perm:" + PermissionNames.PurchasesCreate)]
    public async Task<ActionResult<object>> Create([FromBody] CreatePurchaseBillRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _purchases.CreateAsync(request, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { purchaseBillId = id }, new { purchaseBillId = id });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>Saves a supplier bill as Draft (no stock movement).</summary>
    [HttpPost("drafts")]
    [Authorize(Policy = "perm:" + PermissionNames.PurchasesCreate)]
    public async Task<ActionResult<object>> CreateDraft([FromBody] CreatePurchaseBillRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _purchases.CreateDraftAsync(request, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { purchaseBillId = id }, new { purchaseBillId = id });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("drafts/{purchaseBillId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.PurchasesCreate)]
    public async Task<IActionResult> UpdateDraft(long purchaseBillId, [FromBody] CreatePurchaseBillRequest request, CancellationToken ct)
    {
        try
        {
            var ok = await _purchases.UpdateDraftAsync(purchaseBillId, request, ct).ConfigureAwait(false);
            return ok ? NoContent() : NotFound();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("drafts/{purchaseBillId:long}/post")]
    [Authorize(Policy = "perm:" + PermissionNames.PurchasesCreate)]
    public async Task<IActionResult> PostDraft(long purchaseBillId, CancellationToken ct)
    {
        try
        {
            var ok = await _purchases.PostDraftAsync(purchaseBillId, ct).ConfigureAwait(false);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
