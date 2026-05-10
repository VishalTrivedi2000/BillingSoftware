using BillingApp.Application.Auth;
using BillingApp.Application.Abstractions.Auth;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Globalization;
using System.Linq;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService auth, ILogger<AuthController> logger)
    {
        _auth = auth;
        _logger = logger;
    }

    private static string? FirstClaimValue(ClaimsPrincipal user, params string[] claimTypes)
    {
        foreach (var t in claimTypes)
        {
            var v = user.FindFirstValue(t);
            if (!string.IsNullOrWhiteSpace(v)) return v;
        }

        return null;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var tokens = await _auth.LoginAsync(request, ct).ConfigureAwait(false);
        return tokens is null ? Unauthorized() : Ok(tokens);
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<ActionResult<TokenResponse>> Refresh([FromBody] RefreshRequest request, CancellationToken ct)
    {
        var tokens = await _auth.RefreshAsync(request, ct).ConfigureAwait(false);
        return tokens is null ? Unauthorized() : Ok(tokens);
    }

    [AllowAnonymous]
    [HttpPost("revoke")]
    public async Task<IActionResult> Revoke([FromBody] RefreshRequest request, CancellationToken ct)
    {
        await _auth.RevokeRefreshTokenAsync(request.RefreshToken, ct).ConfigureAwait(false);
        return NoContent();
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!long.TryParse(sub, out var userId))
            return Unauthorized();

        await _auth.RevokeAllSessionsAsync(userId, ct).ConfigureAwait(false);
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<AuthUserSummary>> Me(CancellationToken ct)
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!long.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var userId))
        {
            _logger.LogWarning(
                "GET /auth/me: invalid or missing sub claim (JWT reached controller but User id could not be parsed). sub={Sub}; claims={Claims}",
                sub ?? "(null)",
                string.Join(", ", User.Claims.Select(c => $"{c.Type}={c.Value}")));
            return Unauthorized();
        }

        var tidRaw = FirstClaimValue(User, BillingClaims.TenantId, "tenantId", "TenantId");
        var oidRaw = FirstClaimValue(User, BillingClaims.OrganizationId, "organizationId", "orgId", "OrganizationId");
        if (!long.TryParse(tidRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var tenantId)
            || !long.TryParse(oidRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var organizationId))
        {
            var present = string.Join(", ", User.Claims.Select(c => c.Type).Distinct());
            return Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "JWT workplace claims missing",
                detail: $"Expected tenant_id and org_id (or camelCase equivalents). Present claim types: {present}");
        }

        var summary = await _auth.GetSummaryForUserAsync(userId, tenantId, organizationId, ct).ConfigureAwait(false);
        if (summary is null)
        {
            return Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "Workspace membership check failed",
                detail:
                    $"No matching active membership for UserId={userId}, TenantId={tenantId}, OrganizationId={organizationId}. "
                    + "UserOrganizations must link this user to that organization; Organizations.TenantId must match; "
                    + "Organizations.IsActive and Tenants.IsActive must be 1.");
        }

        return Ok(summary);
    }
}
