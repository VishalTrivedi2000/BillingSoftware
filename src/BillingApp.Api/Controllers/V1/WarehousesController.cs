using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Inventory;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/warehouses")]
public sealed class WarehousesController : ControllerBase
{
    private readonly IWarehouseRepository _warehouses;

    public WarehousesController(IWarehouseRepository warehouses)
    {
        _warehouses = warehouses;
    }

    [HttpGet]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<IReadOnlyList<WarehouseDto>>> List(
        [FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        var rows = await _warehouses.ListAsync(activeOnly, ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{warehouseId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<WarehouseDto>> Get(long warehouseId, CancellationToken ct)
    {
        var row = await _warehouses.GetAsync(warehouseId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.BuiltIn.WarehousesManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreateWarehouseRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _warehouses.CreateAsync(request, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { warehouseId = id }, new { warehouseId = id });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{warehouseId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.WarehousesManage)]
    public async Task<IActionResult> Update(long warehouseId, [FromBody] UpdateWarehouseRequest request, CancellationToken ct)
    {
        try
        {
            var ok = await _warehouses.UpdateAsync(warehouseId, request, ct).ConfigureAwait(false);
            return ok ? NoContent() : NotFound();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{warehouseId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.WarehousesManage)]
    public async Task<IActionResult> Delete(long warehouseId, CancellationToken ct)
    {
        var ok = await _warehouses.SoftDeleteAsync(warehouseId, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }
}
