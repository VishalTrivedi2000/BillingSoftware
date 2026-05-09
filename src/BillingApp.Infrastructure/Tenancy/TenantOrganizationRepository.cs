using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Tenancy;
using Dapper;

namespace BillingApp.Infrastructure.Tenancy;

public sealed class TenantOrganizationRepository : ITenantOrganizationRepository
{
    private readonly IDbConnectionFactory _db;

    public TenantOrganizationRepository(IDbConnectionFactory db) => _db = db;

    public async Task<TenantDto?> GetTenantAsync(long tenantId, CancellationToken ct)
    {
        const string sql = """
            SELECT TenantId, Slug, Name, IsActive, CreatedUtc
            FROM dbo.Tenants WHERE TenantId = @TenantId;
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleOrDefaultAsync<TenantDto>(
            new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<TenantDto>> ListTenantsAsync(CancellationToken ct)
    {
        const string sql = """
            SELECT TenantId, Slug, Name, IsActive, CreatedUtc FROM dbo.Tenants ORDER BY TenantId;
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<TenantDto>(new CommandDefinition(sql, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<bool> TenantSlugTakenAsync(string slug, CancellationToken ct)
    {
        const string sql = """SELECT COUNT(1) FROM dbo.Tenants WHERE Slug = @Slug;""";
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await c.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, new { Slug = slug }, cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }

    public async Task<long> InsertTenantAsync(string slug, string name, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.Tenants (Slug, Name)
            OUTPUT INSERTED.TenantId
            VALUES (@Slug, @Name);
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleAsync<long>(
            new CommandDefinition(sql, new { Slug = slug, Name = name }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<OrganizationDto>> ListOrganizationsByTenantAsync(long tenantId, CancellationToken ct)
    {
        const string sql = """
            SELECT OrganizationId, TenantId, Code, Name, IsActive, CreatedUtc
            FROM dbo.Organizations WHERE TenantId = @TenantId ORDER BY OrganizationId;
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<OrganizationDto>(
            new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<OrganizationDto?> GetOrganizationAsync(long organizationId, long tenantId, CancellationToken ct)
    {
        const string sql = """
            SELECT OrganizationId, TenantId, Code, Name, IsActive, CreatedUtc
            FROM dbo.Organizations WHERE OrganizationId = @OrganizationId AND TenantId = @TenantId;
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleOrDefaultAsync<OrganizationDto>(
            new CommandDefinition(sql, new { OrganizationId = organizationId, TenantId = tenantId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<bool> OrganizationCodeTakenAsync(long tenantId, string code, long? exceptOrganizationId, CancellationToken ct)
    {
        const string sql = """
            SELECT COUNT(1) FROM dbo.Organizations
            WHERE TenantId = @TenantId AND Code = @Code
              AND (@ExceptId IS NULL OR OrganizationId <> @ExceptId);
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await c.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, new { TenantId = tenantId, Code = code, ExceptId = exceptOrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return n > 0;
    }

    public async Task<long> InsertOrganizationAsync(long tenantId, string code, string name, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.Organizations (TenantId, Code, Name)
            OUTPUT INSERTED.OrganizationId
            VALUES (@TenantId, @Code, @Name);
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await c.QuerySingleAsync<long>(
            new CommandDefinition(sql, new { TenantId = tenantId, Code = code, Name = name }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<bool> UpdateOrganizationAsync(long organizationId, long tenantId, string code, string name, bool isActive, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.Organizations SET Code = @Code, Name = @Name, IsActive = @IsActive
            WHERE OrganizationId = @OrganizationId AND TenantId = @TenantId;
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await c.ExecuteAsync(
            new CommandDefinition(sql,
                new { OrganizationId = organizationId, TenantId = tenantId, Code = code, Name = name, IsActive = isActive },
                cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }

    public async Task<IReadOnlyList<OrganizationMembershipDto>> ListMembershipsForUserAsync(long userId, CancellationToken ct)
    {
        const string sql = """
            SELECT o.TenantId, uo.OrganizationId, o.Code AS OrganizationCode, o.Name AS OrganizationName, uo.IsDefault
            FROM dbo.UserOrganizations uo
            INNER JOIN dbo.Organizations o ON o.OrganizationId = uo.OrganizationId
            WHERE uo.UserId = @UserId AND o.IsActive = 1
            ORDER BY uo.IsDefault DESC, o.Name;
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await c.QueryAsync<OrganizationMembershipDto>(
            new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }
}
