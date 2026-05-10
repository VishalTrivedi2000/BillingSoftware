using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class ProductImageRepository : IProductImageRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public ProductImageRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<IReadOnlyList<ProductImageDto>> ListAsync(long productId, CancellationToken ct)
    {
        const string sql = """
            SELECT ProductImageId, RelativePath, ContentType, SortOrder, IsPrimary, CreatedUtc
            FROM dbo.ProductImages
            WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId
            ORDER BY IsPrimary DESC, SortOrder ASC, ProductImageId ASC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<ProductImageDto>(
            new CommandDefinition(sql,
                new { ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<string?> GetRelativePathAsync(long productId, long imageId, CancellationToken ct)
    {
        const string sql = """
            SELECT RelativePath FROM dbo.ProductImages
            WHERE ProductImageId = @ImageId AND ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<string>(
            new CommandDefinition(sql,
                new { ImageId = imageId, ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId },
                cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<long> InsertAsync(long productId, string relativePath, string contentType, bool makePrimary,
        CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);

        var existingCount = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("""
                SELECT COUNT(*) FROM dbo.ProductImages
                WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """,
                new { ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                cancellationToken: ct)).ConfigureAwait(false);

        var isPrimary = makePrimary || existingCount == 0;

        if (isPrimary)
        {
            await conn.ExecuteAsync(
                new CommandDefinition("""
                    UPDATE dbo.ProductImages SET IsPrimary = 0
                    WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                    """,
                    new { ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                    cancellationToken: ct)).ConfigureAwait(false);
        }

        var sortOrder = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("""
                SELECT ISNULL(MAX(SortOrder), -1) + 1 FROM dbo.ProductImages
                WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """,
                new { ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                cancellationToken: ct)).ConfigureAwait(false);

        var id = await conn.QuerySingleAsync<long>(
            new CommandDefinition("""
                INSERT INTO dbo.ProductImages (TenantId, OrganizationId, ProductId, RelativePath, ContentType, SortOrder, IsPrimary)
                OUTPUT INSERTED.ProductImageId
                VALUES (@TenantId, @OrganizationId, @ProductId, @RelativePath, @ContentType, @SortOrder, @IsPrimary);
                """,
                new
                {
                    TenantId = _wp.TenantId,
                    OrganizationId = _wp.OrganizationId,
                    ProductId = productId,
                    RelativePath = relativePath,
                    ContentType = contentType,
                    SortOrder = sortOrder,
                    IsPrimary = isPrimary,
                }, tx, cancellationToken: ct)).ConfigureAwait(false);

        await tx.CommitAsync(ct).ConfigureAwait(false);
        return id;
    }

    public async Task<bool> DeleteAsync(long productId, long imageId, CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);

        var wasPrimary = await conn.QuerySingleOrDefaultAsync<bool?>(
            new CommandDefinition("""
                SELECT IsPrimary FROM dbo.ProductImages
                WHERE ProductImageId = @ImageId AND ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """,
                new { ImageId = imageId, ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                cancellationToken: ct)).ConfigureAwait(false);

        if (!wasPrimary.HasValue)
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            return false;
        }

        var wasPrimaryBool = wasPrimary.Value;

        var n = await conn.ExecuteAsync(
            new CommandDefinition("""
                DELETE FROM dbo.ProductImages
                WHERE ProductImageId = @ImageId AND ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """,
                new { ImageId = imageId, ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                cancellationToken: ct)).ConfigureAwait(false);

        if (n == 0)
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            return false;
        }

        if (wasPrimaryBool && n > 0)
        {
            var nextId = await conn.QuerySingleOrDefaultAsync<long?>(
                new CommandDefinition("""
                    SELECT TOP (1) ProductImageId FROM dbo.ProductImages
                    WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId
                    ORDER BY SortOrder ASC, ProductImageId ASC;
                    """,
                    new { ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                    cancellationToken: ct)).ConfigureAwait(false);

            if (nextId.HasValue)
            {
                await conn.ExecuteAsync(
                    new CommandDefinition("""
                        UPDATE dbo.ProductImages SET IsPrimary = 1
                        WHERE ProductImageId = @NextId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                        """,
                        new { NextId = nextId.Value, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                        cancellationToken: ct)).ConfigureAwait(false);
            }
        }

        await tx.CommitAsync(ct).ConfigureAwait(false);
        return true;
    }

    public async Task<bool> SetPrimaryAsync(long productId, long imageId, CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);

        var exists = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("""
                SELECT COUNT(*) FROM dbo.ProductImages
                WHERE ProductImageId = @ImageId AND ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """,
                new { ImageId = imageId, ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                cancellationToken: ct)).ConfigureAwait(false);
        if (exists == 0)
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            return false;
        }

        await conn.ExecuteAsync(
            new CommandDefinition("""
                UPDATE dbo.ProductImages SET IsPrimary = 0
                WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """,
                new { ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                cancellationToken: ct)).ConfigureAwait(false);

        await conn.ExecuteAsync(
            new CommandDefinition("""
                UPDATE dbo.ProductImages SET IsPrimary = 1
                WHERE ProductImageId = @ImageId AND ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """,
                new { ImageId = imageId, ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                cancellationToken: ct)).ConfigureAwait(false);

        await tx.CommitAsync(ct).ConfigureAwait(false);
        return true;
    }
}
