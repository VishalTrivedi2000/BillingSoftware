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
        CancellationToken ct = default)
    {
        var rows = await _purchases.ListAsync(Math.Max(0, skip), Math.Clamp(take, 1, 200), ct).ConfigureAwait(false);
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
}
