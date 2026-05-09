using System.Security.Cryptography;
using System.Text;
using BillingApp.Application.Abstractions.Auth;
using BillingApp.Application.Auth;
using Microsoft.Extensions.Options;

namespace BillingApp.Infrastructure.Auth;

public sealed class AuthService : IAuthService
{
    private readonly IAuthRepository _repo;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenIssuer _jwt;
    private readonly JwtOptions _jwtOpt;

    public AuthService(
        IAuthRepository repo,
        IPasswordHasher hasher,
        IJwtTokenIssuer jwt,
        IOptions<JwtOptions> jwtOpt)
    {
        _repo = repo;
        _hasher = hasher;
        _jwt = jwt;
        _jwtOpt = jwtOpt.Value;
    }

    public async Task<TokenResponse?> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var user = await _repo.GetUserByUsernameAsync(request.Username, ct).ConfigureAwait(false);
        if (user is not { IsActive: true })
            return null;
        if (!_hasher.VerifyPassword(request.Password, user.PasswordHash))
            return null;

        var wp = await ResolveWorkplaceAsync(user.UserId, request.OrganizationId, ct).ConfigureAwait(false);
        if (wp is null)
            return null;

        var summary = await BuildSummaryAsync(user.UserId, wp.TenantId, wp.OrganizationId, ct).ConfigureAwait(false);
        return summary is null ? null : await IssueTokensAsync(summary, ct).ConfigureAwait(false);
    }

    public async Task<TokenResponse?> RefreshAsync(RefreshRequest request, CancellationToken ct)
    {
        var hash = HashRefreshToken(request.RefreshToken);
        var row = await _repo.GetRefreshTokenByHashAsync(hash, ct).ConfigureAwait(false);
        if (row is null || row.RevokedUtc.HasValue)
            return null;
        if (row.ExpiresUtc < DateTime.UtcNow)
            return null;

        await _repo.RevokeRefreshTokenAsync(row.RefreshTokenId, DateTime.UtcNow, ct).ConfigureAwait(false);

        var wp = await ResolveWorkplaceAsync(row.UserId, request.OrganizationId, ct).ConfigureAwait(false);
        if (wp is null)
            return null;

        var summary = await BuildSummaryAsync(row.UserId, wp.TenantId, wp.OrganizationId, ct).ConfigureAwait(false);
        if (summary is null)
            return null;

        var plainRefresh = GenerateRefreshPlain();
        var newHash = HashRefreshToken(plainRefresh);
        var expires = DateTime.UtcNow.AddDays(_jwtOpt.RefreshTokenDays);
        var newId = await _repo.InsertRefreshTokenAsync(row.UserId, newHash, expires, ct).ConfigureAwait(false);
        await _repo.SetRefreshTokenReplacedByAsync(row.RefreshTokenId, newId, ct).ConfigureAwait(false);

        var (access, expSec) = _jwt.CreateAccessToken(summary);
        return new TokenResponse(access, plainRefresh, expSec, "Bearer", summary.Username,
            summary.Roles.ToList(), summary.Permissions.ToList(), summary.TenantId, summary.OrganizationId);
    }

    public async Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct)
    {
        var hash = HashRefreshToken(refreshToken);
        var row = await _repo.GetRefreshTokenByHashAsync(hash, ct).ConfigureAwait(false);
        if (row is null || row.RevokedUtc.HasValue)
            return;
        await _repo.RevokeRefreshTokenAsync(row.RefreshTokenId, DateTime.UtcNow, ct).ConfigureAwait(false);
    }

    public Task RevokeAllSessionsAsync(long userId, CancellationToken ct) =>
        _repo.RevokeAllRefreshTokensForUserAsync(userId, DateTime.UtcNow, ct);

    public async Task<AuthUserSummary?> GetSummaryForUserAsync(long userId, long tenantId, long organizationId, CancellationToken ct)
    {
        if (!await _repo.UserBelongsToWorkplaceAsync(userId, tenantId, organizationId, ct).ConfigureAwait(false))
            return null;
        return await BuildSummaryAsync(userId, tenantId, organizationId, ct).ConfigureAwait(false);
    }

    public async Task<long> CreateDelegationAsync(long delegatorUserId, CreateDelegationRequest request, CancellationToken ct)
    {
        if (request.DelegateeUserId == delegatorUserId)
            throw new ArgumentException("Cannot delegate to yourself.", nameof(request));

        var delegatee = await _repo.GetUserByIdAsync(request.DelegateeUserId, ct).ConfigureAwait(false)
            ?? throw new InvalidOperationException("Delegatee user not found.");

        var starts = request.StartsUtc.UtcDateTime;
        var expires = request.ExpiresUtc.UtcDateTime;
        if (expires <= starts)
            throw new ArgumentException("ExpiresUtc must be after StartsUtc.");

        _ = delegatee;

        return await _repo.InsertDelegationAsync(delegatorUserId, request.DelegateeUserId, request.RoleId, starts, expires,
            request.Notes, ct).ConfigureAwait(false);
    }

    public async Task<long> CreateUserPermissionGrantAsync(CreateUserPermissionGrantRequest request, CancellationToken ct)
    {
        var permissionName = request.PermissionName.Trim();
        if (string.IsNullOrEmpty(permissionName))
            throw new ArgumentException("Permission name is required.", nameof(request));

        var user = await _repo.GetUserByIdAsync(request.UserId, ct).ConfigureAwait(false)
                   ?? throw new InvalidOperationException("User not found.");
        if (!user.IsActive)
            throw new InvalidOperationException("User is inactive.");

        var pid = await _repo.GetPermissionIdByNameAsync(permissionName, ct).ConfigureAwait(false)
                  ?? throw new ArgumentException($"Unknown permission '{permissionName}'.", nameof(request));

        var starts = request.StartsUtc.UtcDateTime;
        DateTime? expires = request.ExpiresUtc?.UtcDateTime;
        if (expires.HasValue && expires.Value <= starts)
            throw new ArgumentException("ExpiresUtc must be after StartsUtc when provided.", nameof(request));

        var scope = string.IsNullOrWhiteSpace(request.ResourceScope) ? null : request.ResourceScope.Trim();
        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        return await _repo.InsertUserPermissionGrantAsync(request.UserId, pid, starts, expires, scope, notes, ct)
            .ConfigureAwait(false);
    }

    public Task RevokeUserPermissionGrantAsync(long grantId, CancellationToken ct) =>
        _repo.RevokeUserPermissionGrantAsync(grantId, DateTime.UtcNow, ct);

    public async Task<long> CreateUserRoleGrantAsync(CreateUserRoleGrantRequest request, CancellationToken ct)
    {
        var user = await _repo.GetUserByIdAsync(request.UserId, ct).ConfigureAwait(false)
                   ?? throw new InvalidOperationException("User not found.");
        if (!user.IsActive)
            throw new InvalidOperationException("User is inactive.");

        if (!await _repo.RoleExistsAsync(request.RoleId, ct).ConfigureAwait(false))
            throw new ArgumentException($"Unknown role id '{request.RoleId}'.", nameof(request));

        var starts = request.StartsUtc.UtcDateTime;
        DateTime? expires = request.ExpiresUtc?.UtcDateTime;
        if (expires.HasValue && expires.Value <= starts)
            throw new ArgumentException("ExpiresUtc must be after StartsUtc when provided.", nameof(request));

        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        return await _repo.InsertUserRoleGrantAsync(request.UserId, request.RoleId, starts, expires, notes, ct)
            .ConfigureAwait(false);
    }

    public Task RevokeUserRoleGrantAsync(long grantId, CancellationToken ct) =>
        _repo.RevokeUserRoleGrantAsync(grantId, DateTime.UtcNow, ct);

    private async Task<WorkplaceRecord?> ResolveWorkplaceAsync(long userId, long? requestedOrganizationId, CancellationToken ct)
    {
        if (requestedOrganizationId.HasValue)
            return await _repo.GetWorkplaceForUserAsync(userId, requestedOrganizationId.Value, ct).ConfigureAwait(false);
        return await _repo.GetDefaultWorkplaceForUserAsync(userId, ct).ConfigureAwait(false);
    }

    private async Task<AuthUserSummary?> BuildSummaryAsync(long userId, long tenantId, long organizationId, CancellationToken ct)
    {
        var user = await _repo.GetUserByIdAsync(userId, ct).ConfigureAwait(false);
        if (user is not { IsActive: true })
            return null;

        if (!await _repo.UserBelongsToWorkplaceAsync(userId, tenantId, organizationId, ct).ConfigureAwait(false))
            return null;

        var directRoleIds = await _repo.GetRoleIdsForUserAsync(userId, ct).ConfigureAwait(false);
        var delegatedRoleIds = await _repo.GetActiveDelegatedRoleIdsAsync(userId, ct).ConfigureAwait(false);
        var roleGrantsEffective = await _repo.ListEffectiveUserRoleGrantsAsync(userId, ct).ConfigureAwait(false);
        var grantedRoleIds = roleGrantsEffective.Select(g => g.RoleId);

        var mergedRoleIds = directRoleIds.Concat(delegatedRoleIds).Concat(grantedRoleIds).Distinct().ToArray();

        var permissionsFromRoles = await _repo.GetPermissionNamesForRolesAsync(mergedRoleIds, ct).ConfigureAwait(false);
        var grantsEffective = await _repo.ListEffectiveUserPermissionGrantsAsync(userId, ct).ConfigureAwait(false);
        var fromGrants = grantsEffective.Select(g => g.PermissionName);
        var permissions = permissionsFromRoles.Concat(fromGrants).Distinct(StringComparer.Ordinal).OrderBy(p => p).ToArray();

        var roleNames = await _repo.GetRoleNamesForRoleIdsAsync(mergedRoleIds, ct).ConfigureAwait(false);
        var activeRoleGrantDtos = roleGrantsEffective.Select(MapActiveRoleGrant).ToList();
        var activeGrantDtos = grantsEffective.Select(MapActiveGrant).ToList();

        return new AuthUserSummary(user.UserId, user.Username, tenantId, organizationId, roleNames, permissions, activeRoleGrantDtos,
            activeGrantDtos);
    }

    private static ActiveRoleGrantDto MapActiveRoleGrant(UserRoleGrantRow r) =>
        new(
            r.GrantId,
            r.RoleId,
            r.RoleName,
            new DateTimeOffset(DateTime.SpecifyKind(r.StartsUtc, DateTimeKind.Utc)),
            r.ExpiresUtc is null ? null : new DateTimeOffset(DateTime.SpecifyKind(r.ExpiresUtc.Value, DateTimeKind.Utc)));

    private static ActivePermissionGrantDto MapActiveGrant(UserPermissionGrantRow r) =>
        new(
            r.GrantId,
            r.PermissionName,
            new DateTimeOffset(DateTime.SpecifyKind(r.StartsUtc, DateTimeKind.Utc)),
            r.ExpiresUtc is null ? null : new DateTimeOffset(DateTime.SpecifyKind(r.ExpiresUtc.Value, DateTimeKind.Utc)),
            r.ResourceScope);

    private async Task<TokenResponse> IssueTokensAsync(AuthUserSummary summary, CancellationToken ct)
    {
        var (access, expSec) = _jwt.CreateAccessToken(summary);
        var plainRefresh = GenerateRefreshPlain();
        var hash = HashRefreshToken(plainRefresh);
        var expires = DateTime.UtcNow.AddDays(_jwtOpt.RefreshTokenDays);
        await _repo.InsertRefreshTokenAsync(summary.UserId, hash, expires, ct).ConfigureAwait(false);

        return new TokenResponse(access, plainRefresh, expSec, "Bearer", summary.Username,
            summary.Roles.ToList(), summary.Permissions.ToList(), summary.TenantId, summary.OrganizationId);
    }

    private static string GenerateRefreshPlain()
    {
        var bytes = RandomNumberGenerator.GetBytes(48);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static byte[] HashRefreshToken(string token)
    {
        using var sha = SHA256.Create();
        return sha.ComputeHash(Encoding.UTF8.GetBytes(token));
    }
}
