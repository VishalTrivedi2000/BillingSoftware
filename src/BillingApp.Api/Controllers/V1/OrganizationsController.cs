using BillingApp.Application.Abstractions.Auth;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Security;
using BillingApp.Application.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/organizations")]
public sealed class OrganizationsController : ControllerBase
{
    private readonly ITenantOrganizationRepository _orgs;
    private readonly IWorkplaceContext _workplace;
    private readonly IAuthRepository _auth;

    public OrganizationsController(
        ITenantOrganizationRepository orgs,
        IWorkplaceContext workplace,
        IAuthRepository auth)
    {
        _orgs = orgs;
        _workplace = workplace;
        _auth = auth;
    }

    /// <summary>Organizations the signed-in user belongs to (any tenant).</summary>
    [HttpGet("my-memberships")]
    public async Task<ActionResult<IReadOnlyList<OrganizationMembershipDto>>> MyMemberships(CancellationToken ct)
    {
        var userId = RequireUserId();
        if (!userId.HasValue)
            return Unauthorized();
        var rows = await _orgs.ListMembershipsForUserAsync(userId.Value, ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet]
    [Authorize(Policy = "perm:" + PermissionNames.OrganizationsRead)]
    public async Task<ActionResult<IReadOnlyList<OrganizationDto>>> ListForCurrentTenant(CancellationToken ct)
    {
        var rows = await _orgs.ListOrganizationsByTenantAsync(_workplace.TenantId, ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpPost]
    [Authorize(Policy = "perm:" + PermissionNames.OrganizationsManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreateOrganizationRequest request, CancellationToken ct)
    {
        var code = (request.Code ?? string.Empty).Trim();
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(name))
            return BadRequest("Code and name are required.");

        if (await _orgs.OrganizationCodeTakenAsync(_workplace.TenantId, code, exceptOrganizationId: null, ct).ConfigureAwait(false))
            return Conflict($"Organization code '{code}' already exists in this tenant.");

        var id = await _orgs.InsertOrganizationAsync(_workplace.TenantId, code, name, ct).ConfigureAwait(false);
        return CreatedAtAction(nameof(GetOne), new { organizationId = id }, new { organizationId = id });
    }

    [HttpGet("{organizationId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.OrganizationsRead)]
    public async Task<ActionResult<OrganizationDto>> GetOne(long organizationId, CancellationToken ct)
    {
        var row = await _orgs.GetOrganizationAsync(organizationId, _workplace.TenantId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPatch("{organizationId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.OrganizationsManage)]
    public async Task<IActionResult> Update(long organizationId, [FromBody] UpdateOrganizationRequest request, CancellationToken ct)
    {
        var code = (request.Code ?? string.Empty).Trim();
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(name))
            return BadRequest("Code and name are required.");

        if (await _orgs.OrganizationCodeTakenAsync(_workplace.TenantId, code, organizationId, ct).ConfigureAwait(false))
            return Conflict($"Organization code '{code}' already exists in this tenant.");

        var ok = await _orgs.UpdateOrganizationAsync(organizationId, _workplace.TenantId, code, name, request.IsActive, ct)
            .ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{organizationId:long}/members")]
    [Authorize(Policy = "perm:" + PermissionNames.OrganizationsManage)]
    public async Task<IActionResult> AssignMember(long organizationId, [FromBody] AssignOrganizationMemberRequest request, CancellationToken ct)
    {
        var org = await _orgs.GetOrganizationAsync(organizationId, _workplace.TenantId, ct).ConfigureAwait(false);
        if (org is null)
            return NotFound();

        var user = await _auth.GetUserByIdAsync(request.UserId, ct).ConfigureAwait(false);
        if (user is null || !user.IsActive)
            return BadRequest("User not found or inactive.");

        await _auth.EnsureUserOrganizationAsync(request.UserId, organizationId, request.SetAsDefault, ct).ConfigureAwait(false);
        return NoContent();
    }

    private long? RequireUserId()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return long.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : null;
    }
}
