using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using BillingApp.Infrastructure.Billing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/products")]
public sealed class ProductsController : ControllerBase
{
    private static readonly HashSet<string> AllowedImageContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif",
    };

    private readonly IProductRepository _products;
    private readonly IProductImageRepository _productImages;
    private readonly IProductImageStorage _productImageStorage;
    private readonly ProductImageStorageOptions _productImgOpt;
    private readonly IWorkplaceContext _wp;

    public ProductsController(
        IProductRepository products,
        IProductImageRepository productImages,
        IProductImageStorage productImageStorage,
        IOptions<ProductImageStorageOptions> productImgOpt,
        IWorkplaceContext wp)
    {
        _products = products;
        _productImages = productImages;
        _productImageStorage = productImageStorage;
        _productImgOpt = productImgOpt.Value;
        _wp = wp;
    }

    private string ProductFileUrl(string relativePath)
    {
        var root = _productImgOpt.PublicRequestPath.TrimEnd('/');
        var rel = relativePath.Replace('\\', '/').TrimStart('/');
        var req = HttpContext.Request;
        return $"{req.Scheme}://{req.Host.Value}{root}/{rel}";
    }

    [HttpGet("browse")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<ProductBrowseResult>> Browse(
        [FromQuery] string? q,
        [FromQuery] long? categoryId,
        [FromQuery] long? brandId,
        [FromQuery] long? unitId,
        [FromQuery] bool activeOnly = true,
        [FromQuery] string sort = "newest",
        [FromQuery] int skip = 0,
        [FromQuery] int take = 24,
        [FromQuery] bool alertsOnly = false,
        CancellationToken ct = default)
    {
        var query = new ProductBrowseQuery(
            string.IsNullOrWhiteSpace(q) ? null : q.Trim(),
            categoryId,
            brandId,
            unitId,
            activeOnly,
            sort.Trim(),
            Math.Max(0, skip),
            Math.Clamp(take, 1, 100),
            alertsOnly);
        var result = await _products.BrowseAsync(query, ct).ConfigureAwait(false);
        return Ok(result);
    }

    [HttpGet("inventory/summary")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<ProductInventorySummaryDto>> InventorySummary(CancellationToken ct)
    {
        var dto = await _products.GetInventorySummaryAsync(ct).ConfigureAwait(false);
        return Ok(dto);
    }

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

    [HttpGet("{productId:long}/images")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<IReadOnlyList<object>>> ListImages(long productId, CancellationToken ct)
    {
        var product = await _products.GetAsync(productId, ct).ConfigureAwait(false);
        if (product is null)
            return NotFound();

        var rows = await _productImages.ListAsync(productId, ct).ConfigureAwait(false);
        var mapped = rows.Select(r => (object)new
        {
            r.ProductImageId,
            url = ProductFileUrl(r.RelativePath),
            r.ContentType,
            r.SortOrder,
            r.IsPrimary,
            r.CreatedUtc,
        }).ToList();
        return Ok(mapped);
    }

    [HttpPost("{productId:long}/images")]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<ActionResult<object>> UploadImage(
        long productId,
        IFormFile file,
        [FromQuery] bool primary = false,
        CancellationToken ct = default)
    {
        var product = await _products.GetAsync(productId, ct).ConfigureAwait(false);
        if (product is null)
            return NotFound();

        if (file is null || file.Length == 0)
            return BadRequest("No file uploaded.");

        if (file.Length > _productImgOpt.MaxPictureBytes)
            return BadRequest($"File exceeds {_productImgOpt.MaxPictureBytes} bytes.");

        var ctVal = file.ContentType ?? string.Empty;
        if (!AllowedImageContentTypes.Contains(ctVal))
            return BadRequest("Only JPEG, PNG, WebP, or GIF images are allowed.");

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext))
        {
            ext = ctVal switch
            {
                "image/jpeg" => ".jpg",
                "image/png" => ".png",
                "image/webp" => ".webp",
                "image/gif" => ".gif",
                _ => string.Empty,
            };
        }

        if (string.IsNullOrEmpty(ext))
            return BadRequest("Could not determine file extension.");

        string relative;
        try
        {
            await using var stream = file.OpenReadStream();
            relative = await _productImageStorage
                .SaveAsync(_wp.TenantId, _wp.OrganizationId, productId, stream, ext, ctVal, ct).ConfigureAwait(false);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }

        var imageId = await _productImages.InsertAsync(productId, relative, ctVal, primary, ct).ConfigureAwait(false);
        return Ok(new { imageId, url = ProductFileUrl(relative) });
    }

    [HttpDelete("{productId:long}/images/{imageId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<IActionResult> DeleteImage(long productId, long imageId, CancellationToken ct)
    {
        var path = await _productImages.GetRelativePathAsync(productId, imageId, ct).ConfigureAwait(false);
        if (path is null)
            return NotFound();

        var ok = await _productImages.DeleteAsync(productId, imageId, ct).ConfigureAwait(false);
        if (!ok)
            return NotFound();

        await _productImageStorage.TryDeleteAsync(path, ct).ConfigureAwait(false);
        return NoContent();
    }

    [HttpPatch("{productId:long}/images/{imageId:long}/primary")]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<IActionResult> SetPrimaryImage(long productId, long imageId, CancellationToken ct)
    {
        var ok = await _productImages.SetPrimaryAsync(productId, imageId, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
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

        var stock = request.StockQty ?? 0;
        if (stock < 0)
            stock = 0;

        var body = new CreateProductRequest(
            string.IsNullOrWhiteSpace(request.Sku) ? null : request.Sku.Trim(),
            request.Name.Trim(),
            string.IsNullOrWhiteSpace(request.Brand) ? null : request.Brand.Trim(),
            request.UnitPrice,
            request.CategoryId,
            request.BrandId,
            request.UnitId,
            stock,
            request.LowStockThreshold,
            string.IsNullOrWhiteSpace(request.HsnCode) ? null : request.HsnCode.Trim(),
            string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            request.Mrp,
            request.PurchasePrice,
            request.WholesalePrice,
            request.MinWholesaleQty,
            request.TaxRatePercent,
            string.IsNullOrWhiteSpace(request.StorageLocation) ? null : request.StorageLocation.Trim(),
            request.IsService);

        try
        {
            var id = await _products.CreateAsync(body, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { productId = id }, new { productId = id });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPatch("{productId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.ProductsManage)]
    public async Task<IActionResult> Update(long productId, [FromBody] UpdateProductRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");

        var stock = request.StockQty;
        if (stock < 0)
            stock = 0;

        var body = new UpdateProductRequest(
            string.IsNullOrWhiteSpace(request.Sku) ? null : request.Sku.Trim(),
            request.Name.Trim(),
            string.IsNullOrWhiteSpace(request.Brand) ? null : request.Brand.Trim(),
            request.BrandId,
            request.UnitId,
            request.UnitPrice,
            request.CategoryId,
            stock,
            request.LowStockThreshold,
            request.IsActive,
            string.IsNullOrWhiteSpace(request.HsnCode) ? null : request.HsnCode.Trim(),
            string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            request.Mrp,
            request.PurchasePrice,
            request.WholesalePrice,
            request.MinWholesaleQty,
            request.TaxRatePercent,
            string.IsNullOrWhiteSpace(request.StorageLocation) ? null : request.StorageLocation.Trim(),
            request.IsService);

        try
        {
            var ok = await _products.UpdateAsync(productId, body, ct).ConfigureAwait(false);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
