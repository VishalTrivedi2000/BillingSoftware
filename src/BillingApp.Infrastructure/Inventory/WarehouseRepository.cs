using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Inventory;
using Dapper;

namespace BillingApp.Infrastructure.Inventory;

public sealed class WarehouseRepository : IWarehouseRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public WarehouseRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<IReadOnlyList<WarehouseDto>> ListAsync(bool activeOnly, CancellationToken ct)
    {
        const string sql = """
            SELECT WarehouseId, Code, Name, WarehouseType,
                   AddressLine1, AddressLine2, City, StateRegion, PostalCode, Country,
                   ManagerName, ManagerEmail, ManagerPhone,
                   AllowNegativeStock, IsDefault, IsActive, CreatedUtc, UpdatedUtc
            FROM dbo.Warehouses
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
              AND IsDeleted = 0
              AND (@ActiveOnly = 0 OR IsActive = 1)
            ORDER BY IsDefault DESC, Name ASC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<WarehouseDto>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            ActiveOnly = activeOnly ? 1 : 0,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<WarehouseDto?> GetAsync(long warehouseId, CancellationToken ct)
    {
        const string sql = """
            SELECT WarehouseId, Code, Name, WarehouseType,
                   AddressLine1, AddressLine2, City, StateRegion, PostalCode, Country,
                   ManagerName, ManagerEmail, ManagerPhone,
                   AllowNegativeStock, IsDefault, IsActive, CreatedUtc, UpdatedUtc
            FROM dbo.Warehouses
            WHERE WarehouseId = @WarehouseId AND TenantId = @TenantId AND OrganizationId = @OrganizationId
              AND IsDeleted = 0;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<WarehouseDto>(new CommandDefinition(sql, new
        {
            WarehouseId = warehouseId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<long> CreateAsync(CreateWarehouseRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            throw new ArgumentException("Code is required.", nameof(request));
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Name is required.", nameof(request));

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);

        try
        {
            if (request.IsDefault)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "UPDATE dbo.Warehouses SET IsDefault = 0 WHERE TenantId=@TenantId AND OrganizationId=@OrganizationId;",
                    new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx, cancellationToken: ct)).ConfigureAwait(false);
            }

            const string sql = """
                INSERT INTO dbo.Warehouses (
                    TenantId, OrganizationId, Code, Name, WarehouseType,
                    AddressLine1, AddressLine2, City, StateRegion, PostalCode, Country,
                    ManagerName, ManagerEmail, ManagerPhone,
                    AllowNegativeStock, IsDefault, IsActive)
                OUTPUT INSERTED.WarehouseId
                VALUES (@TenantId, @OrganizationId, @Code, @Name, @WarehouseType,
                    @AddressLine1, @AddressLine2, @City, @StateRegion, @PostalCode, @Country,
                    @ManagerName, @ManagerEmail, @ManagerPhone,
                    @AllowNegativeStock, @IsDefault, 1);
                """;
            var id = await conn.QuerySingleAsync<long>(new CommandDefinition(sql, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                Code = request.Code.Trim(),
                Name = request.Name.Trim(),
                WarehouseType = string.IsNullOrWhiteSpace(request.WarehouseType) ? "Store" : request.WarehouseType.Trim(),
                AddressLine1 = NullIfBlank(request.AddressLine1),
                AddressLine2 = NullIfBlank(request.AddressLine2),
                City = NullIfBlank(request.City),
                StateRegion = NullIfBlank(request.StateRegion),
                PostalCode = NullIfBlank(request.PostalCode),
                Country = NullIfBlank(request.Country),
                ManagerName = NullIfBlank(request.ManagerName),
                ManagerEmail = NullIfBlank(request.ManagerEmail),
                ManagerPhone = NullIfBlank(request.ManagerPhone),
                AllowNegativeStock = request.AllowNegativeStock,
                IsDefault = request.IsDefault,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return id;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<bool> UpdateAsync(long warehouseId, UpdateWarehouseRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            throw new ArgumentException("Code is required.", nameof(request));
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Name is required.", nameof(request));

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            if (request.IsDefault)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "UPDATE dbo.Warehouses SET IsDefault = 0 WHERE TenantId=@TenantId AND OrganizationId=@OrganizationId AND WarehouseId<>@WarehouseId;",
                    new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId, WarehouseId = warehouseId }, tx, cancellationToken: ct)).ConfigureAwait(false);
            }

            const string sql = """
                UPDATE dbo.Warehouses
                SET Code = @Code, Name = @Name, WarehouseType = @WarehouseType,
                    AddressLine1 = @AddressLine1, AddressLine2 = @AddressLine2,
                    City = @City, StateRegion = @StateRegion, PostalCode = @PostalCode, Country = @Country,
                    ManagerName = @ManagerName, ManagerEmail = @ManagerEmail, ManagerPhone = @ManagerPhone,
                    AllowNegativeStock = @AllowNegativeStock, IsDefault = @IsDefault, IsActive = @IsActive,
                    UpdatedUtc = SYSUTCDATETIME()
                WHERE WarehouseId = @WarehouseId AND TenantId = @TenantId AND OrganizationId = @OrganizationId
                  AND IsDeleted = 0;
                """;
            var n = await conn.ExecuteAsync(new CommandDefinition(sql, new
            {
                WarehouseId = warehouseId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                Code = request.Code.Trim(),
                Name = request.Name.Trim(),
                WarehouseType = string.IsNullOrWhiteSpace(request.WarehouseType) ? "Store" : request.WarehouseType.Trim(),
                AddressLine1 = NullIfBlank(request.AddressLine1),
                AddressLine2 = NullIfBlank(request.AddressLine2),
                City = NullIfBlank(request.City),
                StateRegion = NullIfBlank(request.StateRegion),
                PostalCode = NullIfBlank(request.PostalCode),
                Country = NullIfBlank(request.Country),
                ManagerName = NullIfBlank(request.ManagerName),
                ManagerEmail = NullIfBlank(request.ManagerEmail),
                ManagerPhone = NullIfBlank(request.ManagerPhone),
                AllowNegativeStock = request.AllowNegativeStock,
                IsDefault = request.IsDefault,
                IsActive = request.IsActive,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return n == 1;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<bool> SoftDeleteAsync(long warehouseId, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.Warehouses
            SET IsDeleted = 1, IsActive = 0, UpdatedUtc = SYSUTCDATETIME()
            WHERE WarehouseId = @WarehouseId AND TenantId = @TenantId AND OrganizationId = @OrganizationId
              AND IsDeleted = 0
              AND IsDefault = 0;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            WarehouseId = warehouseId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return n == 1;
    }

    public async Task<long?> EnsureDefaultWarehouseIdAsync(CancellationToken ct)
    {
        const string select = """
            SELECT TOP 1 WarehouseId FROM dbo.Warehouses
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND IsDeleted = 0
            ORDER BY IsDefault DESC, WarehouseId ASC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var existing = await conn.QuerySingleOrDefaultAsync<long?>(new CommandDefinition(select, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        if (existing.HasValue)
            return existing.Value;

        const string insert = """
            INSERT INTO dbo.Warehouses (TenantId, OrganizationId, Code, Name, WarehouseType, IsDefault, IsActive)
            OUTPUT INSERTED.WarehouseId
            VALUES (@TenantId, @OrganizationId, N'MAIN', N'Main Warehouse', N'Store', 1, 1);
            """;
        try
        {
            return await conn.QuerySingleAsync<long>(new CommandDefinition(insert, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
            }, cancellationToken: ct)).ConfigureAwait(false);
        }
        catch
        {
            return null;
        }
    }

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
