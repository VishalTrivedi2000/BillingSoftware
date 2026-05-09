using BillingApp.Application.Auth;

namespace BillingApp.Application.Abstractions.Auth;

public interface IAuthService
{
    Task<TokenResponse?> LoginAsync(LoginRequest request, CancellationToken ct);
    Task<TokenResponse?> RefreshAsync(RefreshRequest request, CancellationToken ct);
    Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct);
    Task RevokeAllSessionsAsync(long userId, CancellationToken ct);
    Task<AuthUserSummary?> GetSummaryForUserAsync(long userId, long tenantId, long organizationId, CancellationToken ct);
    Task<long> CreateDelegationAsync(long delegatorUserId, CreateDelegationRequest request, CancellationToken ct);
    Task<long> CreateUserPermissionGrantAsync(CreateUserPermissionGrantRequest request, CancellationToken ct);
    Task RevokeUserPermissionGrantAsync(long grantId, CancellationToken ct);
    Task<long> CreateUserRoleGrantAsync(CreateUserRoleGrantRequest request, CancellationToken ct);
    Task RevokeUserRoleGrantAsync(long grantId, CancellationToken ct);
}
