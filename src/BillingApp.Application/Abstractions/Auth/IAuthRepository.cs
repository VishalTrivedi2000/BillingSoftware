namespace BillingApp.Application.Abstractions.Auth;

public interface IAuthRepository
{
    Task<UserAuthRecord?> GetUserByUsernameAsync(string username, CancellationToken ct);
    Task<UserAuthRecord?> GetUserByIdAsync(long userId, CancellationToken ct);
    Task<IReadOnlyList<string>> GetRoleNamesForUserAsync(long userId, CancellationToken ct);
    Task<IReadOnlyList<int>> GetRoleIdsForUserAsync(long userId, CancellationToken ct);
    Task<IReadOnlyList<string>> GetPermissionNamesForRolesAsync(IEnumerable<int> roleIds, CancellationToken ct);
    Task<IReadOnlyList<int>> GetActiveDelegatedRoleIdsAsync(long delegateeUserId, CancellationToken ct);
    Task<long> InsertRefreshTokenAsync(long userId, byte[] tokenHash, DateTime expiresUtc, CancellationToken ct);
    Task<RefreshTokenRecord?> GetRefreshTokenByHashAsync(byte[] tokenHash, CancellationToken ct);
    Task RevokeRefreshTokenAsync(long refreshTokenId, DateTime revokedUtc, CancellationToken ct);
    Task SetRefreshTokenReplacedByAsync(long refreshTokenId, long replacedByTokenId, CancellationToken ct);
    Task RevokeAllRefreshTokensForUserAsync(long userId, DateTime revokedUtc, CancellationToken ct);
    Task<long> InsertDelegationAsync(long delegatorUserId, long delegateeUserId, int roleId, DateTime startsUtc, DateTime expiresUtc, string? notes, CancellationToken ct);
    Task<IReadOnlyList<DelegationRow>> ListActiveDelegationsForDelegateeAsync(long delegateeUserId, CancellationToken ct);
    Task<IReadOnlyList<DelegationRow>> ListDelegationsCreatedByAsync(long delegatorUserId, CancellationToken ct);
    Task<bool> UserHasRoleAsync(long userId, int roleId, CancellationToken ct);
    Task<IReadOnlyList<(long UserId, string Username)>> ListUsersAsync(CancellationToken ct);
    Task<IReadOnlyList<(int RoleId, string Name)>> ListRolesAsync(CancellationToken ct);
    Task<long> InsertUserAsync(string username, string passwordHash, CancellationToken ct, string? developerPlaintextPassword = null);

    /// <summary>Fills <c>DeveloperPlaintextPassword</c> for dev convenience (e.g. seed users created before the column existed).</summary>
    Task SetDeveloperPlaintextPasswordAsync(string username, string plaintextPassword, CancellationToken ct);

    Task AssignUserRoleAsync(long userId, int roleId, CancellationToken ct);
    Task<int?> GetRoleIdByNameAsync(string roleName, CancellationToken ct);
    Task<int?> GetPermissionIdByNameAsync(string permissionName, CancellationToken ct);
    Task EnsureRolePermissionAsync(int roleId, int permissionId, CancellationToken ct);
    Task EnsurePermissionAsync(string permissionName, CancellationToken ct);
    Task EnsureRoleAsync(string roleName, string? description, CancellationToken ct);

    Task<bool> RoleExistsAsync(int roleId, CancellationToken ct);

    Task<IReadOnlyList<string>> GetRoleNamesForRoleIdsAsync(IEnumerable<int> roleIds, CancellationToken ct);

    Task<long> InsertUserRoleGrantAsync(long userId, int roleId, DateTime startsUtc, DateTime? expiresUtc, string? notes, CancellationToken ct);

    Task RevokeUserRoleGrantAsync(long grantId, DateTime revokedUtc, CancellationToken ct);

    Task<IReadOnlyList<UserRoleGrantRow>> ListEffectiveUserRoleGrantsAsync(long userId, CancellationToken ct);

    Task<IReadOnlyList<UserRoleGrantRow>> ListUserRoleGrantsAllAsync(long userId, CancellationToken ct);

    Task<long> InsertUserPermissionGrantAsync(long userId, int permissionId, DateTime startsUtc, DateTime? expiresUtc,
        string? resourceScope, string? notes, CancellationToken ct);

    Task RevokeUserPermissionGrantAsync(long grantId, DateTime revokedUtc, CancellationToken ct);

    /// <summary>Grants that are currently effective (started, not expired, not revoked).</summary>
    Task<IReadOnlyList<UserPermissionGrantRow>> ListEffectiveUserPermissionGrantsAsync(long userId, CancellationToken ct);

    /// <summary>All grant rows for a user (including revoked and not-yet-started), newest first.</summary>
    Task<IReadOnlyList<UserPermissionGrantRow>> ListUserPermissionGrantsAllAsync(long userId, CancellationToken ct);

    Task EnsureUserOrganizationAsync(long userId, long organizationId, bool setAsDefault, CancellationToken ct);

    /// <summary>Default workplace (IsDefault membership), else earliest assignment.</summary>
    Task<WorkplaceRecord?> GetDefaultWorkplaceForUserAsync(long userId, CancellationToken ct);

    Task<WorkplaceRecord?> GetWorkplaceForUserAsync(long userId, long organizationId, CancellationToken ct);

    Task<bool> UserBelongsToWorkplaceAsync(long userId, long tenantId, long organizationId, CancellationToken ct);
}

public sealed record WorkplaceRecord(long TenantId, long OrganizationId);

public sealed record UserAuthRecord(long UserId, string Username, string PasswordHash, bool IsActive);

public sealed record RefreshTokenRecord(long RefreshTokenId, long UserId, DateTime ExpiresUtc, DateTime? RevokedUtc, long? ReplacedByTokenId);

public sealed record DelegationRow(long DelegationId, long DelegatorUserId, long DelegateeUserId, int RoleId, string RoleName, DateTime StartsUtc, DateTime ExpiresUtc, string? Notes);

public sealed record UserPermissionGrantRow(
    long GrantId,
    long UserId,
    string PermissionName,
    DateTime StartsUtc,
    DateTime? ExpiresUtc,
    DateTime? RevokedUtc,
    string? ResourceScope,
    string? Notes);

public sealed record UserRoleGrantRow(
    long GrantId,
    long UserId,
    int RoleId,
    string RoleName,
    DateTime StartsUtc,
    DateTime? ExpiresUtc,
    DateTime? RevokedUtc,
    string? Notes);
