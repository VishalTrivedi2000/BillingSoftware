using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Inventory;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/serials")]
public sealed class ProductSerialsController : ControllerBase
{
    private readonly IProductSerialRepository _serials;

    public ProductSerialsController(IProductSerialRepository serials)
    {
        _serials = serials;
    }

    [HttpGet]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<SerialBrowseResult>> Browse(
        [FromQuery] long? productId,
        [FromQuery] long? productVariantId,
        [FromQuery] long? warehouseId,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var dto = await _serials.BrowseAsync(new SerialBrowseQuery(
            productId, productVariantId, warehouseId,
            string.IsNullOrWhiteSpace(status) ? null : status.Trim(),
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            Math.Max(0, skip), Math.Clamp(take, 1, 500)), ct).ConfigureAwait(false);
        return Ok(dto);
    }

    [HttpGet("{productSerialId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<ProductSerialDto>> Get(long productSerialId, CancellationToken ct)
    {
        var row = await _serials.GetAsync(productSerialId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.BuiltIn.VariantsManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreateProductSerialRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _serials.CreateAsync(request, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { productSerialId = id }, new { productSerialId = id });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
