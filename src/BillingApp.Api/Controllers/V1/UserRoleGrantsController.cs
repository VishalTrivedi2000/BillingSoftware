using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Auth;
using BillingApp.Application.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/user-role-grants")]
public sealed class UserRoleGrantsController : ControllerBase
{
    private readonly IAuthRepository _repo;
    private readonly IAuthService _auth;

    public UserRoleGrantsController(IAuthRepository repo, IAuthService auth)
    {
        _repo = repo;
        _auth = auth;
    }

    [HttpGet("me/active")]
    public async Task<ActionResult<IReadOnlyList<ActiveRoleGrantDto>>> ActiveForMe(CancellationToken ct)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var rows = await _repo.ListEffectiveUserRoleGrantsAsync(userId.Value, ct).ConfigureAwait(false);
        return Ok(rows.Select(MapActive).ToList());
    }

    [HttpGet("user/{userId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.UsersManage)]
    public async Task<ActionResult<IReadOnlyList<UserRoleGrantDto>>> ListForUser(long userId, CancellationToken ct)
    {
        var rows = await _repo.ListUserRoleGrantsAllAsync(userId, ct).ConfigureAwait(false);
        return Ok(rows.Select(MapDto).ToList());
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.BuiltIn.UsersManage)]
    public async Task<ActionResult<long>> Create([FromBody] CreateUserRoleGrantRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _auth.CreateUserRoleGrantAsync(request, ct).ConfigureAwait(false);
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

    [HttpPost("{grantId:long}/revoke")]
    [Authorize(Policy = PolicyNames.BuiltIn.UsersManage)]
    public async Task<IActionResult> Revoke(long grantId, CancellationToken ct)
    {
        await _auth.RevokeUserRoleGrantAsync(grantId, ct).ConfigureAwait(false);
        return NoContent();
    }

    private long? GetUserId()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return long.TryParse(sub, out var id) ? id : null;
    }

    private static ActiveRoleGrantDto MapActive(UserRoleGrantRow r) =>
        new(
            r.GrantId,
            r.RoleId,
            r.RoleName,
            UtcOffset(r.StartsUtc),
            r.ExpiresUtc is null ? null : UtcOffset(r.ExpiresUtc.Value));

    private static UserRoleGrantDto MapDto(UserRoleGrantRow r) =>
        new(
            r.GrantId,
            r.UserId,
            r.RoleId,
            r.RoleName,
            UtcOffset(r.StartsUtc),
            r.ExpiresUtc is null ? null : UtcOffset(r.ExpiresUtc.Value),
            r.RevokedUtc is null ? null : UtcOffset(r.RevokedUtc.Value),
            r.Notes);

    private static DateTimeOffset UtcOffset(DateTime utc) =>
        new(DateTime.SpecifyKind(utc, DateTimeKind.Utc));
}
