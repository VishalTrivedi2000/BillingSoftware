using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class ProductRepository : IProductRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public ProductRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<long> CreateAsync(CreateProductRequest request, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.Products (TenantId, OrganizationId, Sku, Name, UnitPrice)
            OUTPUT INSERTED.ProductId
            VALUES (@TenantId, @OrganizationId, @Sku, @Name, @UnitPrice);
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<long>(
            new CommandDefinition(sql,
                new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId, request.Sku, request.Name, request.UnitPrice },
                cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<ProductDto>> ListAsync(bool activeOnly, int maxRows, CancellationToken ct)
    {
        var sql = activeOnly
            ? """
              SELECT TOP (@Max) ProductId, Sku, Name, UnitPrice, IsActive, CreatedUtc
              FROM dbo.Products
              WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND IsActive = 1
              ORDER BY ProductId DESC;
              """
            : """
              SELECT TOP (@Max) ProductId, Sku, Name, UnitPrice, IsActive, CreatedUtc
              FROM dbo.Products
              WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
              ORDER BY ProductId DESC;
              """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<ProductDto>(
            new CommandDefinition(sql,
                new { Max = maxRows, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<ProductDto?> GetAsync(long productId, CancellationToken ct)
    {
        const string sql = """
            SELECT ProductId, Sku, Name, UnitPrice, IsActive, CreatedUtc
            FROM dbo.Products
            WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<ProductDto>(
            new CommandDefinition(sql,
                new { ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<bool> UpdateAsync(long productId, UpdateProductRequest request, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.Products SET Sku = @Sku, Name = @Name, UnitPrice = @UnitPrice, IsActive = @IsActive
            WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                ProductId = productId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.Sku,
                request.Name,
                request.UnitPrice,
                request.IsActive,
            }, cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }
}
