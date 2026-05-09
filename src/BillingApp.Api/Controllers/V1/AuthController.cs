using BillingApp.Application.Auth;
using BillingApp.Application.Abstractions.Auth;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Globalization;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

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
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (!long.TryParse(sub, out var userId))
            return Unauthorized();

        await _auth.RevokeAllSessionsAsync(userId, ct).ConfigureAwait(false);
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<AuthUserSummary>> Me(CancellationToken ct)
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (!long.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var userId))
            return Unauthorized();

        var tidRaw = User.FindFirstValue(BillingClaims.TenantId);
        var oidRaw = User.FindFirstValue(BillingClaims.OrganizationId);
        if (!long.TryParse(tidRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var tenantId)
            || !long.TryParse(oidRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var organizationId))
            return Unauthorized();

        var summary = await _auth.GetSummaryForUserAsync(userId, tenantId, organizationId, ct).ConfigureAwait(false);
        return summary is null ? Unauthorized() : Ok(summary);
    }
}
