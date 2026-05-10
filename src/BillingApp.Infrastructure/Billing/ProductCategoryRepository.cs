using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class ProductCategoryRepository : IProductCategoryRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public ProductCategoryRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<IReadOnlyList<ProductCategoryDto>> ListAsync(CancellationToken ct)
    {
        const string sql = """
            SELECT CategoryId, ParentCategoryId, Slug, Name, SortOrder, IsActive
            FROM dbo.ProductCategories
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
            ORDER BY SortOrder ASC, Name ASC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<ProductCategoryDto>(
            new CommandDefinition(sql, new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<ProductCategoryDto?> GetAsync(long categoryId, CancellationToken ct)
    {
        const string sql = """
            SELECT CategoryId, ParentCategoryId, Slug, Name, SortOrder, IsActive
            FROM dbo.ProductCategories
            WHERE CategoryId = @CategoryId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<ProductCategoryDto>(
            new CommandDefinition(sql,
                new { CategoryId = categoryId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<bool> SlugTakenAsync(string slug, long? exceptCategoryId, CancellationToken ct)
    {
        const string sql = """
            SELECT COUNT(1)
            FROM dbo.ProductCategories
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND Slug = @Slug
              AND (@Except IS NULL OR CategoryId <> @Except);
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql,
                new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId, Slug = slug, Except = exceptCategoryId },
                cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }

    public async Task<long> CreateAsync(CreateProductCategoryRequest request, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.ProductCategories (TenantId, OrganizationId, ParentCategoryId, Slug, Name, SortOrder)
            OUTPUT INSERTED.CategoryId
            VALUES (@TenantId, @OrganizationId, @ParentCategoryId, @Slug, @Name, @SortOrder);
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<long>(
            new CommandDefinition(sql, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.ParentCategoryId,
                request.Slug,
                request.Name,
                request.SortOrder,
            }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<bool> UpdateAsync(long categoryId, UpdateProductCategoryRequest request, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.ProductCategories
            SET ParentCategoryId = @ParentCategoryId, Slug = @Slug, Name = @Name, SortOrder = @SortOrder, IsActive = @IsActive
            WHERE CategoryId = @CategoryId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                CategoryId = categoryId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.ParentCategoryId,
                request.Slug,
                request.Name,
                request.SortOrder,
                request.IsActive,
            }, cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }
}
