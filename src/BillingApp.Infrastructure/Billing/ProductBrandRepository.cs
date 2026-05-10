using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class ProductBrandRepository : IProductBrandRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public ProductBrandRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<IReadOnlyList<ProductBrandDto>> ListAsync(CancellationToken ct)
    {
        const string sql = """
            SELECT BrandId, Slug, Name, SortOrder, IsActive
            FROM dbo.ProductBrands
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
            ORDER BY SortOrder ASC, Name ASC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<ProductBrandDto>(
            new CommandDefinition(sql, new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<ProductBrandDto?> GetAsync(long brandId, CancellationToken ct)
    {
        const string sql = """
            SELECT BrandId, Slug, Name, SortOrder, IsActive
            FROM dbo.ProductBrands
            WHERE BrandId = @BrandId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<ProductBrandDto>(
            new CommandDefinition(sql,
                new { BrandId = brandId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<string?> GetNameAsync(long brandId, CancellationToken ct)
    {
        const string sql = """
            SELECT Name FROM dbo.ProductBrands
            WHERE BrandId = @BrandId AND TenantId = @TenantId AND OrganizationId = @OrganizationId AND IsActive = 1;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.ExecuteScalarAsync<string?>(
            new CommandDefinition(sql,
                new { BrandId = brandId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<bool> SlugTakenAsync(string slug, long? exceptBrandId, CancellationToken ct)
    {
        const string sql = """
            SELECT COUNT(1)
            FROM dbo.ProductBrands
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND Slug = @Slug
              AND (@Except IS NULL OR BrandId <> @Except);
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql,
                new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId, Slug = slug, Except = exceptBrandId },
                cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }

    public async Task<long> CreateAsync(CreateProductBrandRequest request, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.ProductBrands (TenantId, OrganizationId, Slug, Name, SortOrder)
            OUTPUT INSERTED.BrandId
            VALUES (@TenantId, @OrganizationId, @Slug, @Name, @SortOrder);
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<long>(
            new CommandDefinition(sql, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.Slug,
                request.Name,
                request.SortOrder,
            }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<bool> UpdateAsync(long brandId, UpdateProductBrandRequest request, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.ProductBrands
            SET Slug = @Slug, Name = @Name, SortOrder = @SortOrder, IsActive = @IsActive
            WHERE BrandId = @BrandId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                BrandId = brandId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.Slug,
                request.Name,
                request.SortOrder,
                request.IsActive,
            }, cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }
}
