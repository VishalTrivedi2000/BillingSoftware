using System.Globalization;
using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Auth;
using BillingApp.Application.Auth;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/rbac")]
public sealed class RbacController : ControllerBase
{
    private const string OrgScopeLevel = "organization";
    private readonly IAuthRepository _repo;

    public RbacController(IAuthRepository repo) => _repo = repo;

    [HttpGet("permissions")]
    [Authorize(Policy = PolicyNames.BuiltIn.RolesRead)]
    public async Task<ActionResult<IReadOnlyList<RbacPermissionCatalogEntryDto>>> ListPermissions(CancellationToken ct)
    {
        var rows = await _repo.ListAllPermissionsAsync(ct).ConfigureAwait(false);
        return Ok(rows.Select(MapCatalogEntry).ToList());
    }

    [HttpGet("roles")]
    [Authorize(Policy = PolicyNames.BuiltIn.RolesRead)]
    public async Task<ActionResult<IReadOnlyList<RbacRoleSummaryDto>>> ListRoles(CancellationToken ct)
    {
        var rows = await _repo.ListRolesWithStatsAsync(ct).ConfigureAwait(false);
        return Ok(rows.Select(MapSummary).ToList());
    }

    [HttpGet("roles/{roleId:int}")]
    [Authorize(Policy = PolicyNames.BuiltIn.RolesRead)]
    public async Task<ActionResult<RbacRoleDetailDto>> GetRole(int roleId, CancellationToken ct)
    {
        var role = await _repo.GetRoleAsync(roleId, ct).ConfigureAwait(false);
        if (role is null)
            return NotFound();

        var permIds = await _repo.GetPermissionIdsForRoleAsync(roleId, ct).ConfigureAwait(false);
        return Ok(MapDetail(role.Value.RoleId, role.Value.Name, role.Value.Description, permIds));
    }

    [HttpPut("roles/{roleId:int}/permissions")]
    [Authorize(Policy = PolicyNames.BuiltIn.RolesManage)]
    public async Task<ActionResult<RbacRoleDetailDto>> SetRolePermissions(int roleId, [FromBody] SetRolePermissionsRequest body,
        CancellationToken ct)
    {
        var role = await _repo.GetRoleAsync(roleId, ct).ConfigureAwait(false);
        if (role is null)
            return NotFound();

        if (string.Equals(role.Value.Name, RoleNames.Admin, StringComparison.Ordinal))
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Immutable role", detail: "The Admin role template cannot be edited.");

        var ids = new List<int>();
        foreach (var raw in body.PermissionIds ?? Array.Empty<string>())
        {
            if (!int.TryParse(raw.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var pid))
                return BadRequest($"Invalid permission id '{raw}'.");
            ids.Add(pid);
        }

        try
        {
            await _repo.ReplaceRolePermissionsAsync(roleId, ids, ct).ConfigureAwait(false);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }

        var permIds = await _repo.GetPermissionIdsForRoleAsync(roleId, ct).ConfigureAwait(false);
        return Ok(MapDetail(role.Value.RoleId, role.Value.Name, role.Value.Description, permIds));
    }

    private static RbacPermissionCatalogEntryDto MapCatalogEntry((int PermissionId, string Name) row)
    {
        var name = row.Name;
        var category = PermissionCategory(name);
        var display = HumanizePermissionName(name);
        return new RbacPermissionCatalogEntryDto(row.PermissionId.ToString(CultureInfo.InvariantCulture), name, display, null, category);
    }

    private static RbacRoleSummaryDto MapSummary((int RoleId, string Name, string? Description, int PermissionCount, long UserCount) row)
    {
        var display = row.Name;
        return new RbacRoleSummaryDto(
            row.RoleId.ToString(CultureInfo.InvariantCulture),
            row.Name,
            display,
            row.Description,
            OrgScopeLevel,
            row.PermissionCount,
            row.UserCount);
    }

    private static RbacRoleDetailDto MapDetail(int roleId, string name, string? description, IReadOnlyList<int> permissionIds)
    {
        var ids = permissionIds.Select(i => i.ToString(CultureInfo.InvariantCulture)).ToList();
        return new RbacRoleDetailDto(
            roleId.ToString(CultureInfo.InvariantCulture),
            name,
            name,
            description,
            OrgScopeLevel,
            ids);
    }

    private static string PermissionCategory(string name)
    {
        var i = name.IndexOf('.', StringComparison.Ordinal);
        var prefix = i > 0 ? name[..i] : name;
        return string.IsNullOrEmpty(prefix)
            ? "general"
            : char.ToUpperInvariant(prefix[0]) + prefix[1..].ToLowerInvariant();
    }

    private static string HumanizePermissionName(string name)
    {
        var parts = name.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0)
            return name;
        return string.Join(' ', parts.Select(static p =>
            p.Length == 0 ? p : char.ToUpperInvariant(p[0]) + p[1..].ToLowerInvariant()));
    }
}
