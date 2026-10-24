using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/product-categories")]
public sealed class ProductCategoriesController : ControllerBase
{
    private readonly IProductCategoryRepository _categories;

    public ProductCategoriesController(IProductCategoryRepository categories) => _categories = categories;

    [HttpGet]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<IReadOnlyList<ProductCategoryDto>>> List(CancellationToken ct)
    {
        var rows = await _categories.ListAsync(ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{categoryId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<ProductCategoryDto>> Get(long categoryId, CancellationToken ct)
    {
        var row = await _categories.GetAsync(categoryId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreateProductCategoryRequest request, CancellationToken ct)
    {
        var slug = (request.Slug ?? string.Empty).Trim();
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(slug) || string.IsNullOrEmpty(name))
            return BadRequest("Slug and name are required.");

        if (request.ParentCategoryId.HasValue)
        {
            var parent = await _categories.GetAsync(request.ParentCategoryId.Value, ct).ConfigureAwait(false);
            if (parent is null || !parent.IsActive)
                return BadRequest("Parent category not found or inactive.");
        }

        if (await _categories.SlugTakenAsync(slug, exceptCategoryId: null, ct).ConfigureAwait(false))
            return Conflict("Slug already used in this organization.");

        var id = await _categories.CreateAsync(
            request with { Slug = slug, Name = name },
            ct).ConfigureAwait(false);
        return CreatedAtAction(nameof(Get), new { categoryId = id }, new { categoryId = id });
    }

    [HttpPatch("{categoryId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<IActionResult> Update(long categoryId, [FromBody] UpdateProductCategoryRequest request, CancellationToken ct)
    {
        var slug = (request.Slug ?? string.Empty).Trim();
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(slug) || string.IsNullOrEmpty(name))
            return BadRequest("Slug and name are required.");

        var existing = await _categories.GetAsync(categoryId, ct).ConfigureAwait(false);
        if (existing is null)
            return NotFound();

        if (request.ParentCategoryId == categoryId)
            return BadRequest("Category cannot be its own parent.");

        if (request.ParentCategoryId.HasValue)
        {
            var parent = await _categories.GetAsync(request.ParentCategoryId.Value, ct).ConfigureAwait(false);
            if (parent is null || !parent.IsActive)
                return BadRequest("Parent category not found or inactive.");
        }

        if (await _categories.SlugTakenAsync(slug, categoryId, ct).ConfigureAwait(false))
            return Conflict("Slug already used in this organization.");

        var ok = await _categories.UpdateAsync(categoryId, request with { Slug = slug, Name = name }, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }
}
