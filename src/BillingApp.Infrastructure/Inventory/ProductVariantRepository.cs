using System.Security.Cryptography;
using System.Text;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Inventory;
using Dapper;

namespace BillingApp.Infrastructure.Inventory;

public sealed class ProductVariantRepository : IProductVariantRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public ProductVariantRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    private sealed record VariantRow(
        long ProductVariantId, long ProductId, string ProductName,
        string? Sku, string? Barcode, string? DisplayName, string? AttributeHash,
        decimal? Mrp, decimal? SalePrice, decimal? PurchasePrice,
        string? InventoryTrackingMode, bool IsDefault, string Status, bool IsActive,
        DateTime CreatedUtc, DateTime? UpdatedUtc);

    public async Task<ProductVariantDto?> GetAsync(long productVariantId, CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        const string sql = """
            SELECT v.ProductVariantId, v.ProductId, p.Name AS ProductName,
                   v.Sku, v.Barcode, v.DisplayName, v.AttributeHash,
                   v.Mrp, v.SalePrice, v.PurchasePrice,
                   v.InventoryTrackingMode, v.IsDefault, v.Status, v.IsActive, v.CreatedUtc, v.UpdatedUtc
            FROM dbo.ProductVariants v
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            WHERE v.ProductVariantId = @Id AND v.TenantId = @TenantId AND v.OrganizationId = @OrganizationId
              AND v.IsDeleted = 0;
            """;
        var row = await conn.QuerySingleOrDefaultAsync<VariantRow>(new CommandDefinition(sql, new
        {
            Id = productVariantId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        if (row is null)
            return null;

        var attrs = await LoadAttributesAsync(conn, productVariantId, ct).ConfigureAwait(false);
        return ToDto(row, attrs);
    }

    public async Task<IReadOnlyList<ProductVariantDto>> ListByProductAsync(long productId, bool activeOnly, CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        const string sql = """
            SELECT v.ProductVariantId, v.ProductId, p.Name AS ProductName,
                   v.Sku, v.Barcode, v.DisplayName, v.AttributeHash,
                   v.Mrp, v.SalePrice, v.PurchasePrice,
                   v.InventoryTrackingMode, v.IsDefault, v.Status, v.IsActive, v.CreatedUtc, v.UpdatedUtc
            FROM dbo.ProductVariants v
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            WHERE v.ProductId = @ProductId AND v.TenantId = @TenantId AND v.OrganizationId = @OrganizationId
              AND v.IsDeleted = 0
              AND (@ActiveOnly = 0 OR v.IsActive = 1)
            ORDER BY v.IsDefault DESC, v.ProductVariantId ASC;
            """;
        var rows = (await conn.QueryAsync<VariantRow>(new CommandDefinition(sql, new
        {
            ProductId = productId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            ActiveOnly = activeOnly ? 1 : 0,
        }, cancellationToken: ct)).ConfigureAwait(false)).AsList();
        if (rows.Count == 0)
            return Array.Empty<ProductVariantDto>();

        var ids = rows.ConvertAll(r => r.ProductVariantId);
        var attrs = await LoadAttributesBulkAsync(conn, ids, ct).ConfigureAwait(false);
        return rows.ConvertAll(r => ToDto(r, attrs.TryGetValue(r.ProductVariantId, out var list) ? list : new List<ProductVariantAttributeDto>()));
    }

    public async Task<VariantBrowseResult> BrowseAsync(VariantBrowseQuery query, CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        const string sql = """
            SELECT v.ProductVariantId, v.ProductId, p.Name AS ProductName,
                   v.Sku, v.Barcode, v.DisplayName, v.AttributeHash,
                   v.Mrp, v.SalePrice, v.PurchasePrice,
                   v.InventoryTrackingMode, v.IsDefault, v.Status, v.IsActive, v.CreatedUtc, v.UpdatedUtc
            FROM dbo.ProductVariants v
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            WHERE v.TenantId = @TenantId AND v.OrganizationId = @OrganizationId
              AND v.IsDeleted = 0
              AND (@ActiveOnly = 0 OR v.IsActive = 1)
              AND (@ProductId IS NULL OR v.ProductId = @ProductId)
              AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
              AND (@Search IS NULL
                   OR p.Name LIKE @Like
                   OR v.Sku LIKE @Like
                   OR v.Barcode LIKE @Like)
            ORDER BY v.UpdatedUtc DESC, v.ProductVariantId DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;

            SELECT COUNT(1) FROM dbo.ProductVariants v
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            WHERE v.TenantId = @TenantId AND v.OrganizationId = @OrganizationId
              AND v.IsDeleted = 0
              AND (@ActiveOnly = 0 OR v.IsActive = 1)
              AND (@ProductId IS NULL OR v.ProductId = @ProductId)
              AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
              AND (@Search IS NULL
                   OR p.Name LIKE @Like
                   OR v.Sku LIKE @Like
                   OR v.Barcode LIKE @Like);
            """;
        var like = string.IsNullOrWhiteSpace(query.Search) ? null : $"%{query.Search.Trim()}%";
        using var grid = await conn.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            ActiveOnly = query.ActiveOnly ? 1 : 0,
            ProductId = query.ProductId,
            CategoryId = query.CategoryId,
            Search = like,
            Like = like,
            Skip = Math.Max(0, query.Skip),
            Take = Math.Clamp(query.Take, 1, 100),
        }, cancellationToken: ct)).ConfigureAwait(false);

        var rows = (await grid.ReadAsync<VariantRow>().ConfigureAwait(false)).AsList();
        var total = await grid.ReadSingleAsync<int>().ConfigureAwait(false);

        var ids = rows.ConvertAll(r => r.ProductVariantId);
        var attrs = await LoadAttributesBulkAsync(conn, ids, ct).ConfigureAwait(false);
        var items = rows.ConvertAll(r => ToDto(r, attrs.TryGetValue(r.ProductVariantId, out var list) ? list : new List<ProductVariantAttributeDto>()));
        return new VariantBrowseResult(items, total);
    }

    public async Task<long> CreateAsync(CreateProductVariantRequest request, CancellationToken ct)
    {
        ValidateAttributes(request.Attributes);
        var hash = ComputeAttributeHash(request.Attributes, request.Sku, request.DisplayName);

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            // Sanity check: product must belong to org and not be soft-deleted.
            const string verifyProduct = """
                SELECT 1 FROM dbo.Products
                WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId AND ISNULL(IsDeleted, 0) = 0;
                """;
            var exists = await conn.ExecuteScalarAsync<int?>(new CommandDefinition(verifyProduct, new
            {
                ProductId = request.ProductId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (exists is null)
                throw new InvalidOperationException("Product not found.");

            const string findExistingHash = """
                SELECT TOP 1 ProductVariantId FROM dbo.ProductVariants
                WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND ProductId = @ProductId
                  AND AttributeHash = @AttributeHash AND IsDeleted = 0;
                """;
            var existingId = await conn.QuerySingleOrDefaultAsync<long?>(new CommandDefinition(findExistingHash, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                ProductId = request.ProductId,
                AttributeHash = hash,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (existingId.HasValue)
            {
                await tx.CommitAsync(ct).ConfigureAwait(false);
                return existingId.Value;
            }

            const string insert = """
                INSERT INTO dbo.ProductVariants (
                    TenantId, OrganizationId, ProductId, Sku, Barcode, DisplayName, AttributeHash,
                    Mrp, SalePrice, PurchasePrice, InventoryTrackingMode, IsDefault, Status, IsActive)
                OUTPUT INSERTED.ProductVariantId
                VALUES (@TenantId, @OrganizationId, @ProductId, @Sku, @Barcode, @DisplayName, @AttributeHash,
                    @Mrp, @SalePrice, @PurchasePrice, @InventoryTrackingMode, 0, N'Active', 1);
                """;
            var id = await conn.QuerySingleAsync<long>(new CommandDefinition(insert, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                ProductId = request.ProductId,
                Sku = NullIfBlank(request.Sku),
                Barcode = NullIfBlank(request.Barcode),
                DisplayName = NullIfBlank(request.DisplayName),
                AttributeHash = hash,
                Mrp = request.Mrp,
                SalePrice = request.SalePrice,
                PurchasePrice = request.PurchasePrice,
                InventoryTrackingMode = NullIfBlank(request.InventoryTrackingMode),
            }, tx, cancellationToken: ct)).ConfigureAwait(false);

            await UpsertAttributesAsync(conn, tx, id, request.Attributes, ct).ConfigureAwait(false);

            await EnsureProductMarkedAsVariantEnabledAsync(conn, tx, request.ProductId, ct).ConfigureAwait(false);

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return id;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<bool> UpdateAsync(long productVariantId, UpdateProductVariantRequest request, CancellationToken ct)
    {
        ValidateAttributes(request.Attributes);
        var hash = ComputeAttributeHash(request.Attributes, request.Sku, request.DisplayName);

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            const string sql = """
                UPDATE dbo.ProductVariants
                SET Sku = @Sku, Barcode = @Barcode, DisplayName = @DisplayName, AttributeHash = @AttributeHash,
                    Mrp = @Mrp, SalePrice = @SalePrice, PurchasePrice = @PurchasePrice,
                    InventoryTrackingMode = @InventoryTrackingMode,
                    Status = @Status, IsActive = @IsActive, UpdatedUtc = SYSUTCDATETIME()
                WHERE ProductVariantId = @Id AND TenantId = @TenantId AND OrganizationId = @OrganizationId
                  AND IsDeleted = 0;
                """;
            var n = await conn.ExecuteAsync(new CommandDefinition(sql, new
            {
                Id = productVariantId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                Sku = NullIfBlank(request.Sku),
                Barcode = NullIfBlank(request.Barcode),
                DisplayName = NullIfBlank(request.DisplayName),
                AttributeHash = hash,
                Mrp = request.Mrp,
                SalePrice = request.SalePrice,
                PurchasePrice = request.PurchasePrice,
                InventoryTrackingMode = NullIfBlank(request.InventoryTrackingMode),
                Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim(),
                IsActive = request.IsActive,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);

            if (n == 1)
            {
                await UpsertAttributesAsync(conn, tx, productVariantId, request.Attributes, ct).ConfigureAwait(false);
            }
            await tx.CommitAsync(ct).ConfigureAwait(false);
            return n == 1;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<bool> SoftDeleteAsync(long productVariantId, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.ProductVariants
            SET IsDeleted = 1, IsActive = 0, Status = N'Archived', UpdatedUtc = SYSUTCDATETIME()
            WHERE ProductVariantId = @Id AND TenantId = @TenantId AND OrganizationId = @OrganizationId
              AND IsDefault = 0 AND IsDeleted = 0;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = productVariantId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return n == 1;
    }

    public async Task<long> EnsureDefaultVariantAsync(long productId, CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            // 1. Already have a default variant?
            const string selectExisting = """
                SELECT TOP 1 v.ProductVariantId FROM dbo.ProductVariants v
                WHERE v.TenantId = @TenantId AND v.OrganizationId = @OrganizationId
                  AND v.ProductId = @ProductId AND v.IsDeleted = 0
                ORDER BY v.IsDefault DESC, v.ProductVariantId ASC;
                """;
            var existing = await conn.QuerySingleOrDefaultAsync<long?>(new CommandDefinition(selectExisting, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                ProductId = productId,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (existing.HasValue)
            {
                await WireDefaultVariantAsync(conn, tx, productId, existing.Value, ct).ConfigureAwait(false);
                await tx.CommitAsync(ct).ConfigureAwait(false);
                return existing.Value;
            }

            // 2. Create a default variant inheriting product fields.
            const string productInfo = """
                SELECT Sku, Name, UnitPrice, PurchasePrice, Mrp
                FROM dbo.Products
                WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """;
            var product = await conn.QuerySingleOrDefaultAsync<ProductSeed>(new CommandDefinition(productInfo, new
            {
                ProductId = productId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (product is null)
                throw new InvalidOperationException("Product not found.");

            var hash = ComputeAttributeHash(Array.Empty<ProductVariantAttributeDto>(), product.Sku, product.Name);
            const string findExistingHash = """
                SELECT TOP 1 ProductVariantId FROM dbo.ProductVariants
                WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND ProductId = @ProductId
                  AND AttributeHash = @AttributeHash AND IsDeleted = 0;
                """;
            var existingHashId = await conn.QuerySingleOrDefaultAsync<long?>(new CommandDefinition(findExistingHash, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                ProductId = productId,
                AttributeHash = hash,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (existingHashId.HasValue)
            {
                await WireDefaultVariantAsync(conn, tx, productId, existingHashId.Value, ct).ConfigureAwait(false);
                await tx.CommitAsync(ct).ConfigureAwait(false);
                return existingHashId.Value;
            }

            const string insert = """
                INSERT INTO dbo.ProductVariants (
                    TenantId, OrganizationId, ProductId, Sku, DisplayName, AttributeHash,
                    Mrp, SalePrice, PurchasePrice, IsDefault, Status, IsActive)
                OUTPUT INSERTED.ProductVariantId
                VALUES (@TenantId, @OrganizationId, @ProductId, @Sku, @Name, @AttributeHash,
                    @Mrp, @SalePrice, @PurchasePrice, 1, N'Active', 1);
                """;
            var skuFallback = $"{(string.IsNullOrWhiteSpace(product.Sku) ? "SKU" : product.Sku)}-{productId}";
            var id = await conn.QuerySingleAsync<long>(new CommandDefinition(insert, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                ProductId = productId,
                Sku = product.Sku ?? skuFallback,
                product.Name,
                AttributeHash = hash,
                Mrp = product.Mrp,
                SalePrice = product.UnitPrice,
                PurchasePrice = product.PurchasePrice,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);

            await WireDefaultVariantAsync(conn, tx, productId, id, ct).ConfigureAwait(false);

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return id;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    /* --------------------------- helpers --------------------------- */

    private sealed record ProductSeed(string? Sku, string Name, decimal UnitPrice, decimal? PurchasePrice, decimal? Mrp);

    private static async Task WireDefaultVariantAsync(
        System.Data.Common.DbConnection conn,
        System.Data.Common.DbTransaction tx,
        long productId,
        long variantId,
        CancellationToken ct)
    {
        await conn.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.ProductVariants
            SET IsDefault = 1, UpdatedUtc = SYSUTCDATETIME()
            WHERE ProductVariantId = @VariantId AND IsDefault = 0;
            """,
            new { VariantId = variantId }, tx, cancellationToken: ct)).ConfigureAwait(false);

        await conn.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.Products SET DefaultVariantId = @VariantId
            WHERE ProductId = @ProductId AND DefaultVariantId IS NULL;
            """,
            new { VariantId = variantId, ProductId = productId }, tx, cancellationToken: ct)).ConfigureAwait(false);
    }

    private static ProductVariantDto ToDto(VariantRow row, IList<ProductVariantAttributeDto> attrs)
        => new(
            row.ProductVariantId, row.ProductId, row.ProductName, row.Sku, row.Barcode, row.DisplayName,
            row.AttributeHash, row.Mrp, row.SalePrice, row.PurchasePrice, row.InventoryTrackingMode,
            row.IsDefault, row.Status, row.IsActive, row.CreatedUtc, row.UpdatedUtc, attrs.ToList());

    private static async Task<List<ProductVariantAttributeDto>> LoadAttributesAsync(System.Data.Common.DbConnection conn, long variantId, CancellationToken ct)
    {
        const string sql = """
            SELECT [Key], [Value] FROM dbo.ProductVariantAttributes
            WHERE ProductVariantId = @Id ORDER BY ProductVariantAttributeId;
            """;
        var rows = await conn.QueryAsync<(string Key, string Value)>(new CommandDefinition(sql, new { Id = variantId }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.Select(r => new ProductVariantAttributeDto(r.Key, r.Value)).ToList();
    }

    private static async Task<Dictionary<long, List<ProductVariantAttributeDto>>> LoadAttributesBulkAsync(System.Data.Common.DbConnection conn, IReadOnlyList<long> variantIds, CancellationToken ct)
    {
        if (variantIds.Count == 0)
            return new();
        const string sql = """
            SELECT ProductVariantId, [Key], [Value] FROM dbo.ProductVariantAttributes
            WHERE ProductVariantId IN @Ids ORDER BY ProductVariantId, ProductVariantAttributeId;
            """;
        var rows = await conn.QueryAsync<(long ProductVariantId, string Key, string Value)>(new CommandDefinition(sql, new { Ids = variantIds }, cancellationToken: ct)).ConfigureAwait(false);
        var map = new Dictionary<long, List<ProductVariantAttributeDto>>();
        foreach (var r in rows)
        {
            if (!map.TryGetValue(r.ProductVariantId, out var list))
            {
                list = new List<ProductVariantAttributeDto>();
                map[r.ProductVariantId] = list;
            }
            list.Add(new ProductVariantAttributeDto(r.Key, r.Value));
        }
        return map;
    }

    private static async Task UpsertAttributesAsync(System.Data.Common.DbConnection conn, System.Data.Common.DbTransaction tx, long variantId, IReadOnlyList<ProductVariantAttributeDto> attrs, CancellationToken ct)
    {
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.ProductVariantAttributes WHERE ProductVariantId = @Id;",
            new { Id = variantId }, tx, cancellationToken: ct)).ConfigureAwait(false);
        if (attrs is null || attrs.Count == 0)
            return;
        const string insert = """
            INSERT INTO dbo.ProductVariantAttributes (ProductVariantId, [Key], [Value])
            VALUES (@Id, @Key, @Value);
            """;
        foreach (var a in attrs)
        {
            await conn.ExecuteAsync(new CommandDefinition(insert, new
            {
                Id = variantId,
                Key = a.Key.Trim(),
                Value = a.Value.Trim(),
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
        }
    }

    private static async Task EnsureProductMarkedAsVariantEnabledAsync(System.Data.Common.DbConnection conn, System.Data.Common.DbTransaction tx, long productId, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.Products SET HasVariants = 1
            WHERE ProductId = @ProductId AND HasVariants = 0;
            """;
        await conn.ExecuteAsync(new CommandDefinition(sql, new { ProductId = productId }, tx, cancellationToken: ct)).ConfigureAwait(false);
    }

    private static void ValidateAttributes(IReadOnlyList<ProductVariantAttributeDto> attrs)
    {
        if (attrs is null) return;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var a in attrs)
        {
            if (string.IsNullOrWhiteSpace(a.Key))
                throw new InvalidOperationException("Variant attribute key is required.");
            if (string.IsNullOrWhiteSpace(a.Value))
                throw new InvalidOperationException("Variant attribute value is required.");
            if (!seen.Add(a.Key.Trim()))
                throw new InvalidOperationException($"Duplicate variant attribute key '{a.Key}'.");
        }
    }

    private static string ComputeAttributeHash(
        IReadOnlyList<ProductVariantAttributeDto> attrs,
        string? sku = null,
        string? displayName = null)
    {
        if (attrs is null || attrs.Count == 0)
        {
            if (!string.IsNullOrWhiteSpace(sku))
                return $"@sku:{sku.Trim().ToLowerInvariant()}";
            if (!string.IsNullOrWhiteSpace(displayName))
                return $"@name:{displayName.Trim().ToLowerInvariant()}";
            return "@default";
        }
        var ordered = attrs.OrderBy(a => a.Key, StringComparer.OrdinalIgnoreCase).ToList();
        var sb = new StringBuilder();
        foreach (var a in ordered)
        {
            sb.Append(a.Key.Trim().ToLowerInvariant());
            sb.Append('=');
            sb.Append(a.Value.Trim().ToLowerInvariant());
            sb.Append(';');
        }
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString()));
        var hex = Convert.ToHexString(bytes);
        return hex[..32]; // first 16 bytes ‒ enough collision resistance per (product, org).
    }

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
