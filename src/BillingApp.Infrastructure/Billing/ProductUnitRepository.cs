using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class ProductUnitRepository : IProductUnitRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public ProductUnitRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<IReadOnlyList<ProductUnitDto>> ListAsync(CancellationToken ct)
    {
        const string sql = """
            SELECT UnitId, Code, DisplayName, SortOrder, IsActive
            FROM dbo.ProductUnits
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
            ORDER BY SortOrder ASC, DisplayName ASC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<ProductUnitDto>(
            new CommandDefinition(sql, new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<ProductUnitDto?> GetAsync(long unitId, CancellationToken ct)
    {
        const string sql = """
            SELECT UnitId, Code, DisplayName, SortOrder, IsActive
            FROM dbo.ProductUnits
            WHERE UnitId = @UnitId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<ProductUnitDto>(
            new CommandDefinition(sql,
                new { UnitId = unitId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<bool> CodeTakenAsync(string code, long? exceptUnitId, CancellationToken ct)
    {
        const string sql = """
            SELECT COUNT(1)
            FROM dbo.ProductUnits
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND Code = @Code
              AND (@Except IS NULL OR UnitId <> @Except);
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql,
                new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId, Code = code, Except = exceptUnitId },
                cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }

    public async Task<long> CreateAsync(CreateProductUnitRequest request, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.ProductUnits (TenantId, OrganizationId, Code, DisplayName, SortOrder)
            OUTPUT INSERTED.UnitId
            VALUES (@TenantId, @OrganizationId, @Code, @DisplayName, @SortOrder);
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<long>(
            new CommandDefinition(sql, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.Code,
                request.DisplayName,
                request.SortOrder,
            }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<bool> UpdateAsync(long unitId, UpdateProductUnitRequest request, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.ProductUnits
            SET Code = @Code, DisplayName = @DisplayName, SortOrder = @SortOrder, IsActive = @IsActive
            WHERE UnitId = @UnitId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                UnitId = unitId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.Code,
                request.DisplayName,
                request.SortOrder,
                request.IsActive,
            }, cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }
}
