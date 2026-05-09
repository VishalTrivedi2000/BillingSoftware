using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Security;
using BillingApp.Application.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/tenants")]
public sealed class TenantsController : ControllerBase
{
    private readonly ITenantOrganizationRepository _repo;
    private readonly IWorkplaceContext _workplace;

    public TenantsController(ITenantOrganizationRepository repo, IWorkplaceContext workplace)
    {
        _repo = repo;
        _workplace = workplace;
    }

    /// <summary>Tenant for the current JWT <c>tenant_id</c> claim.</summary>
    [HttpGet("current")]
    public async Task<ActionResult<TenantDto>> Current(CancellationToken ct)
    {
        var row = await _repo.GetTenantAsync(_workplace.TenantId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet]
    [Authorize(Policy = "perm:" + PermissionNames.TenantsRead)]
    public async Task<ActionResult<IReadOnlyList<TenantDto>>> List(CancellationToken ct)
    {
        var rows = await _repo.ListTenantsAsync(ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpPost]
    [Authorize(Policy = "perm:" + PermissionNames.TenantsManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreateTenantRequest request, CancellationToken ct)
    {
        var slug = (request.Slug ?? string.Empty).Trim();
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(slug) || string.IsNullOrEmpty(name))
            return BadRequest("Slug and name are required.");

        if (await _repo.TenantSlugTakenAsync(slug, ct).ConfigureAwait(false))
            return Conflict("Tenant slug must be unique.");

        var id = await _repo.InsertTenantAsync(slug, name, ct).ConfigureAwait(false);
        return StatusCode(StatusCodes.Status201Created, new { tenantId = id });
    }
}
