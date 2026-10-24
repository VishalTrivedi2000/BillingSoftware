using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/product-units")]
public sealed class ProductUnitsController : ControllerBase
{
    private readonly IProductUnitRepository _units;

    public ProductUnitsController(IProductUnitRepository units) => _units = units;

    [HttpGet]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<IReadOnlyList<ProductUnitDto>>> List(CancellationToken ct)
    {
        var rows = await _units.ListAsync(ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{unitId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<ProductUnitDto>> Get(long unitId, CancellationToken ct)
    {
        var row = await _units.GetAsync(unitId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreateProductUnitRequest request, CancellationToken ct)
    {
        var code = (request.Code ?? string.Empty).Trim().ToLowerInvariant();
        var displayName = (request.DisplayName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(displayName))
            return BadRequest("Code and display name are required.");

        if (await _units.CodeTakenAsync(code, exceptUnitId: null, ct).ConfigureAwait(false))
            return Conflict("Code already used in this organization.");

        var id = await _units.CreateAsync(request with { Code = code, DisplayName = displayName }, ct).ConfigureAwait(false);
        return CreatedAtAction(nameof(Get), new { unitId = id }, new { unitId = id });
    }

    [HttpPatch("{unitId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<IActionResult> Update(long unitId, [FromBody] UpdateProductUnitRequest request, CancellationToken ct)
    {
        var code = (request.Code ?? string.Empty).Trim().ToLowerInvariant();
        var displayName = (request.DisplayName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(displayName))
            return BadRequest("Code and display name are required.");

        var existing = await _units.GetAsync(unitId, ct).ConfigureAwait(false);
        if (existing is null)
            return NotFound();

        if (await _units.CodeTakenAsync(code, unitId, ct).ConfigureAwait(false))
            return Conflict("Code already used in this organization.");

        var ok = await _units.UpdateAsync(unitId, request with { Code = code, DisplayName = displayName }, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }
}
