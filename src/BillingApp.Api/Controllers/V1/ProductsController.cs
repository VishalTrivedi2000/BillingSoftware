using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/products")]
public sealed class ProductsController : ControllerBase
{
    private readonly IProductRepository _products;

    public ProductsController(IProductRepository products) => _products = products;

    [HttpGet]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> List(
        [FromQuery] bool activeOnly = false,
        [FromQuery] int max = 200,
        CancellationToken ct = default)
    {
        var rows = await _products.ListAsync(activeOnly, Math.Clamp(max, 1, 500), ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{productId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<ProductDto>> Get(long productId, CancellationToken ct)
    {
        var row = await _products.GetAsync(productId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreateProductRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        var id = await _products.CreateAsync(
            request with { Name = request.Name.Trim(), Sku = string.IsNullOrWhiteSpace(request.Sku) ? null : request.Sku.Trim() },
            ct).ConfigureAwait(false);
        return CreatedAtAction(nameof(Get), new { productId = id }, new { productId = id });
    }

    [HttpPatch("{productId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<IActionResult> Update(long productId, [FromBody] UpdateProductRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        var ok = await _products.UpdateAsync(productId,
            request with { Name = request.Name.Trim(), Sku = string.IsNullOrWhiteSpace(request.Sku) ? null : request.Sku.Trim() },
            ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }
}
