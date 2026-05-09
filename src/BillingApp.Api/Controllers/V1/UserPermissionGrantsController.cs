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
[Route("api/v1/user-permission-grants")]
public sealed class UserPermissionGrantsController : ControllerBase
{
    private readonly IAuthRepository _repo;
    private readonly IAuthService _auth;

    public UserPermissionGrantsController(IAuthRepository repo, IAuthService auth)
    {
        _repo = repo;
        _auth = auth;
    }

    /// <summary>Effective grants for the signed-in user (subset of JWT permission claims with expiry metadata).</summary>
    [HttpGet("me/active")]
    public async Task<ActionResult<IReadOnlyList<ActivePermissionGrantDto>>> ActiveForMe(CancellationToken ct)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var rows = await _repo.ListEffectiveUserPermissionGrantsAsync(userId.Value, ct).ConfigureAwait(false);
        return Ok(rows.Select(MapActive).ToList());
    }

    /// <summary>All grants for a user (scheduled, expired, revoked) — admin only.</summary>
    [HttpGet("user/{userId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.UsersManage)]
    public async Task<ActionResult<IReadOnlyList<UserPermissionGrantDto>>> ListForUser(long userId, CancellationToken ct)
    {
        var rows = await _repo.ListUserPermissionGrantsAllAsync(userId, ct).ConfigureAwait(false);
        return Ok(rows.Select(MapDto).ToList());
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.BuiltIn.UsersManage)]
    public async Task<ActionResult<long>> Create([FromBody] CreateUserPermissionGrantRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _auth.CreateUserPermissionGrantAsync(request, ct).ConfigureAwait(false);
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
        await _auth.RevokeUserPermissionGrantAsync(grantId, ct).ConfigureAwait(false);
        return NoContent();
    }

    private long? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return long.TryParse(sub, out var id) ? id : null;
    }

    private static ActivePermissionGrantDto MapActive(UserPermissionGrantRow r) =>
        new(
            r.GrantId,
            r.PermissionName,
            UtcOffset(r.StartsUtc),
            r.ExpiresUtc is null ? null : UtcOffset(r.ExpiresUtc.Value),
            r.ResourceScope);

    private static UserPermissionGrantDto MapDto(UserPermissionGrantRow r) =>
        new(
            r.GrantId,
            r.UserId,
            r.PermissionName,
            UtcOffset(r.StartsUtc),
            r.ExpiresUtc is null ? null : UtcOffset(r.ExpiresUtc.Value),
            r.RevokedUtc is null ? null : UtcOffset(r.RevokedUtc.Value),
            r.ResourceScope,
            r.Notes);

    private static DateTimeOffset UtcOffset(DateTime utc) =>
        new(DateTime.SpecifyKind(utc, DateTimeKind.Utc));
}
