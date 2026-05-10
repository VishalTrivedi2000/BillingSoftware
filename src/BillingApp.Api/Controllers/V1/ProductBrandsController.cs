using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/product-brands")]
public sealed class ProductBrandsController : ControllerBase
{
    private readonly IProductBrandRepository _brands;

    public ProductBrandsController(IProductBrandRepository brands) => _brands = brands;

    [HttpGet]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<IReadOnlyList<ProductBrandDto>>> List(CancellationToken ct)
    {
        var rows = await _brands.ListAsync(ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{brandId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<ProductBrandDto>> Get(long brandId, CancellationToken ct)
    {
        var row = await _brands.GetAsync(brandId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreateProductBrandRequest request, CancellationToken ct)
    {
        var slug = (request.Slug ?? string.Empty).Trim().ToLowerInvariant();
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(slug) || string.IsNullOrEmpty(name))
            return BadRequest("Slug and name are required.");

        if (await _brands.SlugTakenAsync(slug, exceptBrandId: null, ct).ConfigureAwait(false))
            return Conflict("Slug already used in this organization.");

        var id = await _brands.CreateAsync(request with { Slug = slug, Name = name }, ct).ConfigureAwait(false);
        return CreatedAtAction(nameof(Get), new { brandId = id }, new { brandId = id });
    }

    [HttpPatch("{brandId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<IActionResult> Update(long brandId, [FromBody] UpdateProductBrandRequest request, CancellationToken ct)
    {
        var slug = (request.Slug ?? string.Empty).Trim().ToLowerInvariant();
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(slug) || string.IsNullOrEmpty(name))
            return BadRequest("Slug and name are required.");

        var existing = await _brands.GetAsync(brandId, ct).ConfigureAwait(false);
        if (existing is null)
            return NotFound();

        if (await _brands.SlugTakenAsync(slug, brandId, ct).ConfigureAwait(false))
            return Conflict("Slug already used in this organization.");

        var ok = await _brands.UpdateAsync(brandId, request with { Slug = slug, Name = name }, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }
}
