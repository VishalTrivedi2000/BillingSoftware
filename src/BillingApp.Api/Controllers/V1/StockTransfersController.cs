using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Inventory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/stock-transfers")]
public sealed class StockTransfersController : ControllerBase
{
    private readonly IStockTransferRepository _transfers;

    public StockTransfersController(IStockTransferRepository transfers)
    {
        _transfers = transfers;
    }

    [HttpGet]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<IReadOnlyList<StockTransferSummaryDto>>> List(
        [FromQuery] string? status,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var rows = await _transfers.ListAsync(
            string.IsNullOrWhiteSpace(status) ? null : status.Trim(),
            Math.Max(0, skip),
            Math.Clamp(take, 1, 500), ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{stockTransferId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<StockTransferDto>> Get(long stockTransferId, CancellationToken ct)
    {
        var row = await _transfers.GetAsync(stockTransferId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryTransfer)]
    public async Task<ActionResult<object>> Create([FromBody] CreateStockTransferRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _transfers.CreateAsync(request, User?.Identity?.Name, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { stockTransferId = id }, new { stockTransferId = id });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
