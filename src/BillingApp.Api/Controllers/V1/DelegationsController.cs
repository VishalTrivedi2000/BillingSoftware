using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Auth;
using BillingApp.Application.Auth;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/[controller]")]
public sealed class DelegationsController : ControllerBase
{
    private readonly IAuthRepository _repo;
    private readonly IAuthService _auth;

    public DelegationsController(IAuthRepository repo, IAuthService auth)
    {
        _repo = repo;
        _auth = auth;
    }

    [HttpGet("active-for-me")]
    public async Task<ActionResult<IReadOnlyList<DelegationDto>>> ActiveForMe(CancellationToken ct)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var rows = await _repo.ListActiveDelegationsForDelegateeAsync(userId.Value, ct).ConfigureAwait(false);
        return Ok(rows.Select(Map).ToList());
    }

    [HttpGet("created-by-me")]
    [Authorize(Policy = PolicyNames.BuiltIn.DelegationsManage)]
    public async Task<ActionResult<IReadOnlyList<DelegationDto>>> CreatedByMe(CancellationToken ct)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var rows = await _repo.ListDelegationsCreatedByAsync(userId.Value, ct).ConfigureAwait(false);
        return Ok(rows.Select(Map).ToList());
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.BuiltIn.DelegationsManage)]
    public async Task<ActionResult<long>> Create([FromBody] CreateDelegationRequest request, CancellationToken ct)
    {
        var delegatorId = GetUserId();
        if (!delegatorId.HasValue)
            return Unauthorized();

        try
        {
            var id = await _auth.CreateDelegationAsync(delegatorId.Value, request, ct).ConfigureAwait(false);
            return Ok(id);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("users")]
    [Authorize(Policy = PolicyNames.BuiltIn.DelegationsManage)]
    public async Task<ActionResult<IReadOnlyList<object>>> Users(CancellationToken ct)
    {
        var users = await _repo.ListUsersAsync(ct).ConfigureAwait(false);
        return Ok(users.Select(u => new { userId = u.UserId, username = u.Username }).ToList());
    }

    [HttpGet("roles")]
    [Authorize(Policy = PolicyNames.BuiltIn.DelegationsManage)]
    public async Task<ActionResult<IReadOnlyList<object>>> Roles(CancellationToken ct)
    {
        var roles = await _repo.ListRolesAsync(ct).ConfigureAwait(false);
        return Ok(roles.Select(r => new { roleId = r.RoleId, name = r.Name }).ToList());
    }

    private long? GetUserId()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return long.TryParse(sub, out var id) ? id : null;
    }

    private static DelegationDto Map(DelegationRow r) =>
        new(
            r.DelegationId,
            r.DelegatorUserId,
            r.DelegateeUserId,
            r.RoleId,
            r.RoleName,
            new DateTimeOffset(DateTime.SpecifyKind(r.StartsUtc, DateTimeKind.Utc)),
            new DateTimeOffset(DateTime.SpecifyKind(r.ExpiresUtc, DateTimeKind.Utc)),
            r.Notes);
}
