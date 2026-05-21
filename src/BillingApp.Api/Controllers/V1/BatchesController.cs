using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Inventory;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/batches")]
public sealed class BatchesController : ControllerBase
{
    private readonly IBatchRepository _batches;

    public BatchesController(IBatchRepository batches)
    {
        _batches = batches;
    }

    [HttpGet]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<BatchBrowseResult>> Browse(
        [FromQuery] long? productVariantId,
        [FromQuery] string? search,
        [FromQuery] string? qualityStatus,
        [FromQuery] DateTime? expiryBeforeUtc,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var dto = await _batches.BrowseAsync(new BatchBrowseQuery(
            productVariantId,
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            string.IsNullOrWhiteSpace(qualityStatus) ? null : qualityStatus.Trim(),
            expiryBeforeUtc,
            Math.Max(0, skip), Math.Clamp(take, 1, 500)), ct).ConfigureAwait(false);
        return Ok(dto);
    }

    [HttpGet("{batchId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.CatalogRead)]
    public async Task<ActionResult<BatchDto>> Get(long batchId, CancellationToken ct)
    {
        var row = await _batches.GetAsync(batchId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.BuiltIn.VariantsManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreateBatchRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _batches.CreateAsync(request, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { batchId = id }, new { batchId = id });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
