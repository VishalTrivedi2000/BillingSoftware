using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Inventory;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/inventory")]
public sealed class InventoryController : ControllerBase
{
    private readonly IInventoryRepository _inventory;

    public InventoryController(IInventoryRepository inventory)
    {
        _inventory = inventory;
    }

    [HttpGet("dashboard")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<InventoryDashboardDto>> Dashboard(CancellationToken ct)
    {
        var dto = await _inventory.GetDashboardAsync(ct).ConfigureAwait(false);
        return Ok(dto);
    }

    [HttpGet("balances")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<InventoryBalanceResult>> Balances(
        [FromQuery] long? warehouseId,
        [FromQuery] long? productId,
        [FromQuery] long? categoryId,
        [FromQuery] string? search,
        [FromQuery] bool lowStockOnly = false,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var query = new InventoryBalanceQuery(
            warehouseId, productId, categoryId,
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            lowStockOnly, Math.Max(0, skip), Math.Clamp(take, 1, 500));
        var dto = await _inventory.BalancesAsync(query, ct).ConfigureAwait(false);
        return Ok(dto);
    }

    [HttpGet("ledger")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<InventoryLedgerResult>> Ledger(
        [FromQuery] long? warehouseId,
        [FromQuery] long? productVariantId,
        [FromQuery] long? productId,
        [FromQuery] string? transactionType,
        [FromQuery] string? search,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var query = new InventoryLedgerQuery(
            warehouseId, productVariantId, productId,
            string.IsNullOrWhiteSpace(transactionType) ? null : transactionType.Trim().ToUpperInvariant(),
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            fromUtc, toUtc, Math.Max(0, skip), Math.Clamp(take, 1, 500));
        var dto = await _inventory.LedgerAsync(query, ct).ConfigureAwait(false);
        return Ok(dto);
    }

    [HttpGet("ledger/{inventoryTransactionId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<InventoryTransactionDto>> GetTransaction(long inventoryTransactionId, CancellationToken ct)
    {
        var dto = await _inventory.GetTransactionAsync(inventoryTransactionId, ct).ConfigureAwait(false);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("adjustments")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryAdjust)]
    public async Task<ActionResult<StockAdjustmentResultDto>> SubmitAdjustment(
        [FromBody] SubmitStockAdjustmentRequest request, CancellationToken ct)
    {
        try
        {
            var dto = await _inventory.SubmitAdjustmentAsync(request, User?.Identity?.Name, ct).ConfigureAwait(false);
            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("adjustments/{adjustmentApprovalId:long}/approve")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryAdjust)]
    public async Task<IActionResult> ApproveAdjustment(long adjustmentApprovalId, CancellationToken ct)
    {
        var ok = await _inventory.ApproveAdjustmentAsync(adjustmentApprovalId, User?.Identity?.Name, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }
}
