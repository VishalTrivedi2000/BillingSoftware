using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Inventory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/inventory/reports")]
public sealed class InventoryReportsController : ControllerBase
{
    private readonly IInventoryReportRepository _reports;

    public InventoryReportsController(IInventoryReportRepository reports)
    {
        _reports = reports;
    }

    [HttpGet("stock-summary")]
    [Authorize(Policy = PolicyNames.BuiltIn.ReportsInventory)]
    public async Task<ActionResult<StockSummaryReport>> StockSummary(
        [FromQuery] long? warehouseId,
        [FromQuery] long? categoryId,
        [FromQuery] string? search,
        CancellationToken ct = default)
    {
        var dto = await _reports.StockSummaryAsync(warehouseId, categoryId,
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(), ct).ConfigureAwait(false);
        return Ok(dto);
    }

    [HttpGet("low-stock")]
    [Authorize(Policy = PolicyNames.BuiltIn.ReportsInventory)]
    public async Task<ActionResult<IReadOnlyList<LowStockReportRow>>> LowStock(
        [FromQuery] long? warehouseId, CancellationToken ct = default)
    {
        var rows = await _reports.LowStockAsync(warehouseId, ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("expiry-fefo")]
    [Authorize(Policy = PolicyNames.BuiltIn.ReportsInventory)]
    public async Task<ActionResult<IReadOnlyList<ExpiryFefoReportRow>>> ExpiryFefo(
        [FromQuery] long? warehouseId,
        [FromQuery] int? daysWindow,
        CancellationToken ct = default)
    {
        var rows = await _reports.ExpiryFefoAsync(warehouseId, daysWindow, ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("serial-trace")]
    [Authorize(Policy = PolicyNames.BuiltIn.ReportsInventory)]
    public async Task<ActionResult<IReadOnlyList<SerialTraceReportRow>>> SerialTrace(
        [FromQuery] string? search,
        [FromQuery] long? productVariantId,
        [FromQuery] string? status,
        CancellationToken ct = default)
    {
        var rows = await _reports.SerialTraceAsync(
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            productVariantId,
            string.IsNullOrWhiteSpace(status) ? null : status.Trim(),
            ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("item-profit")]
    [Authorize(Policy = PolicyNames.BuiltIn.ReportsProfitability)]
    public async Task<ActionResult<IReadOnlyList<ItemProfitReportRow>>> ItemProfit(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        CancellationToken ct = default)
    {
        var rows = await _reports.ItemProfitAsync(fromUtc, toUtc, ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("valuation")]
    [Authorize(Policy = PolicyNames.BuiltIn.ReportsInventory)]
    public async Task<ActionResult<IReadOnlyList<InventoryValuationReportRow>>> Valuation(
        [FromQuery] long? warehouseId,
        [FromQuery] long? categoryId,
        [FromQuery] string costingMethod = "AverageCost",
        CancellationToken ct = default)
    {
        var rows = await _reports.ValuationAsync(warehouseId, categoryId, costingMethod, ct).ConfigureAwait(false);
        return Ok(rows);
    }
}
