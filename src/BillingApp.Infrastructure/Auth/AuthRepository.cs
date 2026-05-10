using BillingApp.Application.Abstractions.Auth;
using BillingApp.Application.Abstractions.Data;
using Dapper;

namespace BillingApp.Infrastructure.Auth;

public sealed class AuthRepository : IAuthRepository
{
    private readonly IDbConnectionFactory _db;

    public AuthRepository(IDbConnectionFactory db) => _db = db;

    public async Task<UserAuthRecord?> GetUserByUsernameAsync(string username, CancellationToken ct)
    {
        const string sql = """
            SELECT UserId, Username, PasswordHash, IsActive
            FROM dbo.Users
            WHERE Username = @Username
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleOrDefaultAsync<UserAuthRecord>(
            new CommandDefinition(sql, new { Username = username }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<UserAuthRecord?> GetUserByIdAsync(long userId, CancellationToken ct)
    {
        const string sql = """
            SELECT UserId, Username, PasswordHash, IsActive
            FROM dbo.Users
            WHERE UserId = @UserId
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleOrDefaultAsync<UserAuthRecord>(
            new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<string>> GetRoleNamesForUserAsync(long userId, CancellationToken ct)
    {
        const string sql = """
            SELECT r.Name
            FROM dbo.UserRoles ur
            INNER JOIN dbo.Roles r ON r.RoleId = ur.RoleId
            WHERE ur.UserId = @UserId
            ORDER BY r.Name
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<string>(new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<int>> GetRoleIdsForUserAsync(long userId, CancellationToken ct)
    {
        const string sql = "SELECT RoleId FROM dbo.UserRoles WHERE UserId = @UserId";
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<int>(new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<string>> GetPermissionNamesForRolesAsync(IEnumerable<int> roleIds, CancellationToken ct)
    {
        var ids = roleIds.Distinct().ToArray();
        if (ids.Length == 0)
            return Array.Empty<string>();

        const string sql = """
            SELECT DISTINCT p.Name
            FROM dbo.RolePermissions rp
            INNER JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId
            WHERE rp.RoleId IN @RoleIds
            ORDER BY p.Name
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<string>(new CommandDefinition(sql, new { RoleIds = ids }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<int>> GetActiveDelegatedRoleIdsAsync(long delegateeUserId, CancellationToken ct)
    {
        const string sql = """
            SELECT RoleId
            FROM dbo.Delegations
            WHERE DelegateeUserId = @UserId
              AND RevokedUtc IS NULL
              AND SYSUTCDATETIME() >= StartsUtc
              AND SYSUTCDATETIME() < ExpiresUtc
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<int>(new CommandDefinition(sql, new { UserId = delegateeUserId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<long> InsertRefreshTokenAsync(long userId, byte[] tokenHash, DateTime expiresUtc, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresUtc)
            OUTPUT INSERTED.RefreshTokenId
            VALUES (@UserId, @TokenHash, @ExpiresUtc)
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleAsync<long>(new CommandDefinition(sql,
            new { UserId = userId, TokenHash = tokenHash, ExpiresUtc = expiresUtc }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<RefreshTokenRecord?> GetRefreshTokenByHashAsync(byte[] tokenHash, CancellationToken ct)
    {
        const string sql = """
            SELECT RefreshTokenId, UserId, ExpiresUtc, RevokedUtc, ReplacedByTokenId
            FROM dbo.RefreshTokens
            WHERE TokenHash = @TokenHash
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleOrDefaultAsync<RefreshTokenRecord>(
            new CommandDefinition(sql, new { TokenHash = tokenHash }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task RevokeRefreshTokenAsync(long refreshTokenId, DateTime revokedUtc, CancellationToken ct)
    {
        const string sql = "UPDATE dbo.RefreshTokens SET RevokedUtc = @RevokedUtc WHERE RefreshTokenId = @Id";
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql, new { Id = refreshTokenId, RevokedUtc = revokedUtc }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task SetRefreshTokenReplacedByAsync(long refreshTokenId, long replacedByTokenId, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.RefreshTokens SET ReplacedByTokenId = @NewId WHERE RefreshTokenId = @OldId
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql, new { OldId = refreshTokenId, NewId = replacedByTokenId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task RevokeAllRefreshTokensForUserAsync(long userId, DateTime revokedUtc, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.RefreshTokens SET RevokedUtc = @RevokedUtc
            WHERE UserId = @UserId AND RevokedUtc IS NULL
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql, new { UserId = userId, RevokedUtc = revokedUtc }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<long> InsertDelegationAsync(long delegatorUserId, long delegateeUserId, int roleId, DateTime startsUtc,
        DateTime expiresUtc, string? notes, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.Delegations (DelegatorUserId, DelegateeUserId, RoleId, StartsUtc, ExpiresUtc, Notes)
            OUTPUT INSERTED.DelegationId
            VALUES (@DelegatorUserId, @DelegateeUserId, @RoleId, @StartsUtc, @ExpiresUtc, @Notes)
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleAsync<long>(new CommandDefinition(sql,
            new { DelegatorUserId = delegatorUserId, DelegateeUserId = delegateeUserId, RoleId = roleId, StartsUtc = startsUtc, ExpiresUtc = expiresUtc, Notes = notes },
            cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<DelegationRow>> ListActiveDelegationsForDelegateeAsync(long delegateeUserId, CancellationToken ct)
    {
        const string sql = """
            SELECT d.DelegationId, d.DelegatorUserId, d.DelegateeUserId, d.RoleId, r.Name AS RoleName,
                   d.StartsUtc, d.ExpiresUtc, d.Notes
            FROM dbo.Delegations d
            INNER JOIN dbo.Roles r ON r.RoleId = d.RoleId
            WHERE d.DelegateeUserId = @UserId AND d.RevokedUtc IS NULL
              AND SYSUTCDATETIME() >= d.StartsUtc AND SYSUTCDATETIME() < d.ExpiresUtc
            ORDER BY d.ExpiresUtc
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<DelegationRow>(new CommandDefinition(sql, new { UserId = delegateeUserId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<DelegationRow>> ListDelegationsCreatedByAsync(long delegatorUserId, CancellationToken ct)
    {
        const string sql = """
            SELECT d.DelegationId, d.DelegatorUserId, d.DelegateeUserId, d.RoleId, r.Name AS RoleName,
                   d.StartsUtc, d.ExpiresUtc, d.Notes
            FROM dbo.Delegations d
            INNER JOIN dbo.Roles r ON r.RoleId = d.RoleId
            WHERE d.DelegatorUserId = @UserId AND d.RevokedUtc IS NULL
            ORDER BY d.StartsUtc DESC
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<DelegationRow>(new CommandDefinition(sql, new { UserId = delegatorUserId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<bool> UserHasRoleAsync(long userId, int roleId, CancellationToken ct)
    {
        const string sql = "SELECT COUNT(1) FROM dbo.UserRoles WHERE UserId = @UserId AND RoleId = @RoleId";
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await c.ExecuteScalarAsync<int>(new CommandDefinition(sql, new { UserId = userId, RoleId = roleId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return n > 0;
    }

    public async Task<IReadOnlyList<(long UserId, string Username)>> ListUsersAsync(CancellationToken ct)
    {
        const string sql = "SELECT UserId, Username FROM dbo.Users WHERE IsActive = 1 ORDER BY Username";
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<(long, string)>(new CommandDefinition(sql, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<(int RoleId, string Name)>> ListRolesAsync(CancellationToken ct)
    {
        const string sql = "SELECT RoleId, Name FROM dbo.Roles ORDER BY Name";
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<(int, string)>(new CommandDefinition(sql, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<long> InsertUserAsync(string username, string passwordHash, CancellationToken ct,
        string? developerPlaintextPassword = null)
    {
        const string sql = """
            INSERT INTO dbo.Users (Username, PasswordHash, DeveloperPlaintextPassword)
            OUTPUT INSERTED.UserId
            VALUES (@Username, @PasswordHash, @DeveloperPlaintextPassword)
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleAsync<long>(
            new CommandDefinition(sql,
                new { Username = username, PasswordHash = passwordHash, DeveloperPlaintextPassword = developerPlaintextPassword },
                cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task SetDeveloperPlaintextPasswordAsync(string username, string plaintextPassword, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.Users SET DeveloperPlaintextPassword = @Plain WHERE Username = @Username
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql,
            new { Username = username, Plain = plaintextPassword }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task AssignUserRoleAsync(long userId, int roleId, CancellationToken ct)
    {
        const string sql = """
            IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId=@UserId AND RoleId=@RoleId)
            INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId)
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql, new { UserId = userId, RoleId = roleId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<int?> GetRoleIdByNameAsync(string roleName, CancellationToken ct)
    {
        const string sql = "SELECT RoleId FROM dbo.Roles WHERE Name = @Name";
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.ExecuteScalarAsync<int?>(new CommandDefinition(sql, new { Name = roleName }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<int?> GetPermissionIdByNameAsync(string permissionName, CancellationToken ct)
    {
        const string sql = "SELECT PermissionId FROM dbo.Permissions WHERE Name = @Name";
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.ExecuteScalarAsync<int?>(new CommandDefinition(sql, new { Name = permissionName }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task EnsureRolePermissionAsync(int roleId, int permissionId, CancellationToken ct)
    {
        const string sql = """
            IF NOT EXISTS (SELECT 1 FROM dbo.RolePermissions WHERE RoleId=@RoleId AND PermissionId=@PermissionId)
            INSERT INTO dbo.RolePermissions (RoleId, PermissionId) VALUES (@RoleId, @PermissionId)
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql, new { RoleId = roleId, PermissionId = permissionId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task EnsurePermissionAsync(string permissionName, CancellationToken ct)
    {
        const string sql = """
            IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Name=@Name)
            INSERT INTO dbo.Permissions (Name) VALUES (@Name)
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql, new { Name = permissionName }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task EnsureRoleAsync(string roleName, string? description, CancellationToken ct)
    {
        const string sql = """
            IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name=@Name)
            INSERT INTO dbo.Roles (Name, Description) VALUES (@Name, @Description)
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql, new { Name = roleName, Description = description }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<bool> RoleExistsAsync(int roleId, CancellationToken ct)
    {
        const string sql = "SELECT COUNT(1) FROM dbo.Roles WHERE RoleId = @RoleId";
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await c.ExecuteScalarAsync<int>(new CommandDefinition(sql, new { RoleId = roleId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return n > 0;
    }

    public async Task<IReadOnlyList<string>> GetRoleNamesForRoleIdsAsync(IEnumerable<int> roleIds, CancellationToken ct)
    {
        var ids = roleIds.Distinct().ToArray();
        if (ids.Length == 0)
            return Array.Empty<string>();

        const string sql = """
            SELECT r.Name
            FROM dbo.Roles r
            WHERE r.RoleId IN @RoleIds
            ORDER BY r.Name
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<string>(new CommandDefinition(sql, new { RoleIds = ids }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<long> InsertUserRoleGrantAsync(long userId, int roleId, DateTime startsUtc, DateTime? expiresUtc, string? notes,
        CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.UserRoleGrants (UserId, RoleId, StartsUtc, ExpiresUtc, Notes)
            OUTPUT INSERTED.GrantId
            VALUES (@UserId, @RoleId, @StartsUtc, @ExpiresUtc, @Notes)
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleAsync<long>(new CommandDefinition(sql,
            new { UserId = userId, RoleId = roleId, StartsUtc = startsUtc, ExpiresUtc = expiresUtc, Notes = notes },
            cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task RevokeUserRoleGrantAsync(long grantId, DateTime revokedUtc, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.UserRoleGrants
            SET RevokedUtc = COALESCE(RevokedUtc, @RevokedUtc)
            WHERE GrantId = @GrantId
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql, new { GrantId = grantId, RevokedUtc = revokedUtc }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<UserRoleGrantRow>> ListEffectiveUserRoleGrantsAsync(long userId, CancellationToken ct)
    {
        const string sql = """
            SELECT g.GrantId, g.UserId, g.RoleId, r.Name AS RoleName, g.StartsUtc, g.ExpiresUtc, g.RevokedUtc, g.Notes
            FROM dbo.UserRoleGrants g
            INNER JOIN dbo.Roles r ON r.RoleId = g.RoleId
            WHERE g.UserId = @UserId
              AND g.RevokedUtc IS NULL
              AND SYSUTCDATETIME() >= g.StartsUtc
              AND (g.ExpiresUtc IS NULL OR SYSUTCDATETIME() < g.ExpiresUtc)
            ORDER BY r.Name, g.GrantId
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<UserRoleGrantRow>(new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<UserRoleGrantRow>> ListUserRoleGrantsAllAsync(long userId, CancellationToken ct)
    {
        const string sql = """
            SELECT g.GrantId, g.UserId, g.RoleId, r.Name AS RoleName, g.StartsUtc, g.ExpiresUtc, g.RevokedUtc, g.Notes
            FROM dbo.UserRoleGrants g
            INNER JOIN dbo.Roles r ON r.RoleId = g.RoleId
            WHERE g.UserId = @UserId
            ORDER BY g.StartsUtc DESC, g.GrantId DESC
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<UserRoleGrantRow>(new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<long> InsertUserPermissionGrantAsync(long userId, int permissionId, DateTime startsUtc, DateTime? expiresUtc,
        string? resourceScope, string? notes, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.UserPermissionGrants (UserId, PermissionId, StartsUtc, ExpiresUtc, ResourceScope, Notes)
            OUTPUT INSERTED.GrantId
            VALUES (@UserId, @PermissionId, @StartsUtc, @ExpiresUtc, @ResourceScope, @Notes)
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleAsync<long>(new CommandDefinition(sql,
            new { UserId = userId, PermissionId = permissionId, StartsUtc = startsUtc, ExpiresUtc = expiresUtc, ResourceScope = resourceScope, Notes = notes },
            cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task RevokeUserPermissionGrantAsync(long grantId, DateTime revokedUtc, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.UserPermissionGrants
            SET RevokedUtc = COALESCE(RevokedUtc, @RevokedUtc)
            WHERE GrantId = @GrantId
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql, new { GrantId = grantId, RevokedUtc = revokedUtc }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<UserPermissionGrantRow>> ListEffectiveUserPermissionGrantsAsync(long userId, CancellationToken ct)
    {
        const string sql = """
            SELECT g.GrantId, g.UserId, p.Name AS PermissionName, g.StartsUtc, g.ExpiresUtc, g.RevokedUtc, g.ResourceScope, g.Notes
            FROM dbo.UserPermissionGrants g
            INNER JOIN dbo.Permissions p ON p.PermissionId = g.PermissionId
            WHERE g.UserId = @UserId
              AND g.RevokedUtc IS NULL
              AND SYSUTCDATETIME() >= g.StartsUtc
              AND (g.ExpiresUtc IS NULL OR SYSUTCDATETIME() < g.ExpiresUtc)
            ORDER BY p.Name, g.GrantId
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<UserPermissionGrantRow>(new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<UserPermissionGrantRow>> ListUserPermissionGrantsAllAsync(long userId, CancellationToken ct)
    {
        const string sql = """
            SELECT g.GrantId, g.UserId, p.Name AS PermissionName, g.StartsUtc, g.ExpiresUtc, g.RevokedUtc, g.ResourceScope, g.Notes
            FROM dbo.UserPermissionGrants g
            INNER JOIN dbo.Permissions p ON p.PermissionId = g.PermissionId
            WHERE g.UserId = @UserId
            ORDER BY g.StartsUtc DESC, g.GrantId DESC
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<UserPermissionGrantRow>(new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task EnsureUserOrganizationAsync(long userId, long organizationId, bool setAsDefault, CancellationToken ct)
    {
        const string insertIfMissing = """
            IF NOT EXISTS (SELECT 1 FROM dbo.UserOrganizations WHERE UserId = @UserId AND OrganizationId = @OrganizationId)
              INSERT INTO dbo.UserOrganizations (UserId, OrganizationId, IsDefault) VALUES (@UserId, @OrganizationId, 0);
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(insertIfMissing, new { UserId = userId, OrganizationId = organizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        if (!setAsDefault)
            return;
        const string setDefault = """
            UPDATE dbo.UserOrganizations SET IsDefault = 0 WHERE UserId = @UserId;
            UPDATE dbo.UserOrganizations SET IsDefault = 1 WHERE UserId = @UserId AND OrganizationId = @OrganizationId;
            """;
        await c.ExecuteAsync(new CommandDefinition(setDefault, new { UserId = userId, OrganizationId = organizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<WorkplaceRecord?> GetDefaultWorkplaceForUserAsync(long userId, CancellationToken ct)
    {
        const string sql = """
            SELECT TOP (1) o.TenantId, uo.OrganizationId
            FROM dbo.UserOrganizations uo
            INNER JOIN dbo.Organizations o ON o.OrganizationId = uo.OrganizationId AND o.IsActive = 1
            INNER JOIN dbo.Tenants t ON t.TenantId = o.TenantId AND t.IsActive = 1
            WHERE uo.UserId = @UserId
            ORDER BY CASE WHEN uo.IsDefault = 1 THEN 0 ELSE 1 END, uo.AssignedUtc ASC;
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleOrDefaultAsync<WorkplaceRecord>(
            new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<WorkplaceRecord?> GetWorkplaceForUserAsync(long userId, long organizationId, CancellationToken ct)
    {
        const string sql = """
            SELECT o.TenantId, uo.OrganizationId
            FROM dbo.UserOrganizations uo
            INNER JOIN dbo.Organizations o ON o.OrganizationId = uo.OrganizationId AND o.IsActive = 1
            INNER JOIN dbo.Tenants t ON t.TenantId = o.TenantId AND t.IsActive = 1
            WHERE uo.UserId = @UserId AND uo.OrganizationId = @OrganizationId;
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleOrDefaultAsync<WorkplaceRecord>(
            new CommandDefinition(sql, new { UserId = userId, OrganizationId = organizationId }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<bool> UserBelongsToWorkplaceAsync(long userId, long tenantId, long organizationId, CancellationToken ct)
    {
        const string sql = """
            SELECT CAST(CASE WHEN EXISTS (
                SELECT 1
                FROM dbo.UserOrganizations uo
                INNER JOIN dbo.Organizations o ON o.OrganizationId = uo.OrganizationId AND o.IsActive = 1
                INNER JOIN dbo.Tenants t ON t.TenantId = o.TenantId AND t.IsActive = 1
                WHERE uo.UserId = @UserId AND uo.OrganizationId = @OrganizationId AND o.TenantId = @TenantId
            ) THEN 1 ELSE 0 END AS BIT);
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleAsync<bool>(
            new CommandDefinition(sql, new { UserId = userId, TenantId = tenantId, OrganizationId = organizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<(int PermissionId, string Name)>> ListAllPermissionsAsync(CancellationToken ct)
    {
        const string sql = """
            SELECT PermissionId, Name
            FROM dbo.Permissions
            ORDER BY Name
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<(int PermissionId, string Name)>(new CommandDefinition(sql, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<(int RoleId, string Name, string? Description, int PermissionCount, long UserCount)>> ListRolesWithStatsAsync(
        CancellationToken ct)
    {
        const string sql = """
            SELECT
              r.RoleId AS RoleId,
              r.Name AS Name,
              r.Description AS Description,
              (
                SELECT COUNT(*)
                FROM dbo.RolePermissions rp
                WHERE rp.RoleId = r.RoleId
              ) AS PermissionCount,
              (
                SELECT COUNT(*)
                FROM (
                  SELECT ur.UserId AS UserId
                  FROM dbo.UserRoles ur
                  WHERE ur.RoleId = r.RoleId
                  UNION
                  SELECT g.UserId AS UserId
                  FROM dbo.UserRoleGrants g
                  WHERE g.RoleId = r.RoleId
                    AND g.RevokedUtc IS NULL
                    AND SYSUTCDATETIME() >= g.StartsUtc
                    AND (g.ExpiresUtc IS NULL OR SYSUTCDATETIME() < g.ExpiresUtc)
                ) u
              ) AS UserCount
            FROM dbo.Roles r
            ORDER BY r.Name
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows =
            await c.QueryAsync<(int RoleId, string Name, string? Description, int PermissionCount, long UserCount)>(
                    new CommandDefinition(sql, cancellationToken: ct))
                .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<(int RoleId, string Name, string? Description)?> GetRoleAsync(int roleId, CancellationToken ct)
    {
        const string sql = """
            SELECT RoleId, Name, Description
            FROM dbo.Roles
            WHERE RoleId = @RoleId
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var row = await c.QuerySingleOrDefaultAsync<(int RoleId, string Name, string? Description)>(
                new CommandDefinition(sql, new { RoleId = roleId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return row.RoleId == roleId ? row : null;
    }

    public async Task<IReadOnlyList<int>> GetPermissionIdsForRoleAsync(int roleId, CancellationToken ct)
    {
        const string sql = """
            SELECT rp.PermissionId
            FROM dbo.RolePermissions rp
            WHERE rp.RoleId = @RoleId
            ORDER BY rp.PermissionId
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<int>(new CommandDefinition(sql, new { RoleId = roleId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task ReplaceRolePermissionsAsync(int roleId, IReadOnlyList<int> permissionIds, CancellationToken ct)
    {
        var distinct = permissionIds.Distinct().ToArray();
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await c.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            if (distinct.Length > 0)
            {
                const string validateSql = """
                    SELECT COUNT(*)
                    FROM dbo.Permissions
                    WHERE PermissionId IN @Ids
                    """;
                var ok = await c.ExecuteScalarAsync<int>(new CommandDefinition(validateSql, new { Ids = distinct }, tx, cancellationToken: ct))
                    .ConfigureAwait(false);
                if (ok != distinct.Length)
                    throw new ArgumentException("One or more permission ids are unknown.");
            }

            await c.ExecuteAsync(
                    new CommandDefinition("DELETE FROM dbo.RolePermissions WHERE RoleId=@RoleId", new { RoleId = roleId }, tx,
                        cancellationToken: ct))
                .ConfigureAwait(false);

            foreach (var pid in distinct)
            {
                await c.ExecuteAsync(
                        new CommandDefinition(
                            """
                            INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
                            VALUES (@RoleId, @PermissionId)
                            """,
                            new { RoleId = roleId, PermissionId = pid },
                            tx,
                            cancellationToken: ct))
                    .ConfigureAwait(false);
            }

            await tx.CommitAsync(ct).ConfigureAwait(false);
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }
}
