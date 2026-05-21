using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Inventory;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1")]
public sealed class ProductVariantsController : ControllerBase
{
    private readonly IProductVariantRepository _variants;

    public ProductVariantsController(IProductVariantRepository variants)
    {
        _variants = variants;
    }

    [HttpGet("products/{productId:long}/variants")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<IReadOnlyList<ProductVariantDto>>> ListByProduct(
        long productId, [FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        var rows = await _variants.ListByProductAsync(productId, activeOnly, ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("variants")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<VariantBrowseResult>> Browse(
        [FromQuery] string? search,
        [FromQuery] long? productId,
        [FromQuery] long? categoryId,
        [FromQuery] bool activeOnly = false,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 25,
        CancellationToken ct = default)
    {
        var result = await _variants.BrowseAsync(new VariantBrowseQuery(search, productId, categoryId, activeOnly, skip, take), ct).ConfigureAwait(false);
        return Ok(result);
    }

    [HttpGet("variants/{productVariantId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<ProductVariantDto>> Get(long productVariantId, CancellationToken ct)
    {
        var row = await _variants.GetAsync(productVariantId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("variants")]
    [Authorize(Policy = PolicyNames.BuiltIn.VariantsManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreateProductVariantRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _variants.CreateAsync(request, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { productVariantId = id }, new { productVariantId = id });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("variants/{productVariantId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.VariantsManage)]
    public async Task<IActionResult> Update(long productVariantId, [FromBody] UpdateProductVariantRequest request, CancellationToken ct)
    {
        try
        {
            var ok = await _variants.UpdateAsync(productVariantId, request, ct).ConfigureAwait(false);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("variants/{productVariantId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.VariantsManage)]
    public async Task<IActionResult> Delete(long productVariantId, CancellationToken ct)
    {
        var ok = await _variants.SoftDeleteAsync(productVariantId, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("products/{productId:long}/variants/default")]
    [Authorize(Policy = PolicyNames.BuiltIn.VariantsManage)]
    public async Task<ActionResult<object>> EnsureDefault(long productId, CancellationToken ct)
    {
        try
        {
            var id = await _variants.EnsureDefaultVariantAsync(productId, ct).ConfigureAwait(false);
            return Ok(new { productVariantId = id });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
