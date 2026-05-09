using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BillingApp.Application.Abstractions.Auth;
using BillingApp.Application.Auth;
using BillingApp.Application.Security;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace BillingApp.Infrastructure.Auth;

public sealed class JwtTokenIssuer : IJwtTokenIssuer
{
    private readonly JwtOptions _opt;

    public JwtTokenIssuer(IOptions<JwtOptions> options) => _opt = options.Value;

    public (string Token, int ExpiresInSeconds) CreateAccessToken(AuthUserSummary user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opt.SigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        foreach (var r in user.Roles)
            claims.Add(new Claim(ClaimTypes.Role, r));

        foreach (var p in user.Permissions.Distinct(StringComparer.Ordinal))
            claims.Add(new Claim(BillingClaims.Permission, p));

        claims.Add(new Claim(BillingClaims.TenantId, user.TenantId.ToString()));
        claims.Add(new Claim(BillingClaims.OrganizationId, user.OrganizationId.ToString()));

        var expires = DateTime.UtcNow.AddMinutes(_opt.AccessTokenMinutes);
        var token = new JwtSecurityToken(
            issuer: _opt.Issuer,
            audience: _opt.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        var jwt = new JwtSecurityTokenHandler().WriteToken(token);
        return (jwt, (int)(expires - DateTime.UtcNow).TotalSeconds);
    }
}