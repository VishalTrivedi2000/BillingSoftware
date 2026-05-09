using BillingApp.Application.Auth;

namespace BillingApp.Application.Abstractions.Auth;

public interface IJwtTokenIssuer
{
    (string Token, int ExpiresInSeconds) CreateAccessToken(AuthUserSummary user);
}
