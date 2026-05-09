namespace BillingApp.Application.Auth;

public sealed record LoginRequest(string Username, string Password, long? OrganizationId = null);

public sealed record RefreshRequest(string RefreshToken, long? OrganizationId = null);

public sealed record TokenResponse(
    string AccessToken,
    string RefreshToken,
    int ExpiresInSeconds,
    string TokenType,
    string Username,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    long TenantId,
    long OrganizationId);

public sealed record AuthUserSummary(
    long UserId,
    string Username,
    long TenantId,
    long OrganizationId,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    IReadOnlyList<ActiveRoleGrantDto> ActiveRoleGrants,
    IReadOnlyList<ActivePermissionGrantDto> ActivePermissionGrants);

public sealed record ActiveRoleGrantDto(
    long GrantId,
    int RoleId,
    string RoleName,
    DateTimeOffset StartsUtc,
    DateTimeOffset? ExpiresUtc);

public sealed record ActivePermissionGrantDto(
    long GrantId,
    string Permission,
    DateTimeOffset StartsUtc,
    DateTimeOffset? ExpiresUtc,
    string? ResourceScope);

public sealed record CreateUserPermissionGrantRequest(
    long UserId,
    string PermissionName,
    DateTimeOffset StartsUtc,
    DateTimeOffset? ExpiresUtc,
    string? ResourceScope,
    string? Notes);

public sealed record UserPermissionGrantDto(
    long GrantId,
    long UserId,
    string Permission,
    DateTimeOffset StartsUtc,
    DateTimeOffset? ExpiresUtc,
    DateTimeOffset? RevokedUtc,
    string? ResourceScope,
    string? Notes);

public sealed record CreateUserRoleGrantRequest(
    long UserId,
    int RoleId,
    DateTimeOffset StartsUtc,
    DateTimeOffset? ExpiresUtc,
    string? Notes);

public sealed record UserRoleGrantDto(
    long GrantId,
    long UserId,
    int RoleId,
    string RoleName,
    DateTimeOffset StartsUtc,
    DateTimeOffset? ExpiresUtc,
    DateTimeOffset? RevokedUtc,
    string? Notes);

public sealed record CreateDelegationRequest(
    long DelegateeUserId,
    int RoleId,
    DateTimeOffset StartsUtc,
    DateTimeOffset ExpiresUtc,
    string? Notes);

public sealed record DelegationDto(
    long DelegationId,
    long DelegatorUserId,
    long DelegateeUserId,
    int RoleId,
    string RoleName,
    DateTimeOffset StartsUtc,
    DateTimeOffset ExpiresUtc,
    string? Notes);
