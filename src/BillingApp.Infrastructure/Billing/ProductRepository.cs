using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class ProductRepository : IProductRepository
{
    private const string ExtendedSelectColumns = """
        p.Tags, p.Manufacturer, p.Barcode, p.CountryOfOrigin, p.InternalCode, p.ManufacturerPartNo, p.Visibility,
        p.InventoryTrackingMode, p.ProductNature, p.HasVariants, p.AllowNegativeStock,
        p.LeadTimeDays, p.WarrantyMonths, p.ShelfLifeDays, p.IsReturnable, p.ReorderQty, p.MaxStock, p.LowStockAlert
        """;

    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;
    private readonly IProductBrandRepository _brands;
    private readonly IProductUnitRepository _units;

    public ProductRepository(
        IDbConnectionFactory db,
        IWorkplaceContext wp,
        IProductBrandRepository brands,
        IProductUnitRepository units)
    {
        _db = db;
        _wp = wp;
        _brands = brands;
        _units = units;
    }

    public async Task<long> CreateAsync(CreateProductRequest request, CancellationToken ct)
    {
        await EnsureCategoryScopeAsync(request.CategoryId, ct).ConfigureAwait(false);
        await EnsureBrandScopeAsync(request.BrandId, ct).ConfigureAwait(false);
        await EnsureUnitScopeAsync(request.UnitId, ct).ConfigureAwait(false);

        var brandText = string.IsNullOrWhiteSpace(request.Brand) ? null : request.Brand.Trim();
        if (request.BrandId.HasValue)
            brandText = await _brands.GetNameAsync(request.BrandId.Value, ct).ConfigureAwait(false);

        const string sql = """
            INSERT INTO dbo.Products (TenantId, OrganizationId, CategoryId, BrandId, UnitId, Sku, Name, Brand, UnitPrice, StockQty, LowStockThreshold,
              HsnCode, Description, Mrp, PurchasePrice, WholesalePrice, MinWholesaleQty, TaxRatePercent, StorageLocation, IsService,
              Tags, Manufacturer, Barcode, CountryOfOrigin, InternalCode, ManufacturerPartNo, Visibility,
              InventoryTrackingMode, ProductNature, AllowNegativeStock, LeadTimeDays, WarrantyMonths, ShelfLifeDays,
              IsReturnable, ReorderQty, MaxStock, LowStockAlert)
            OUTPUT INSERTED.ProductId
            VALUES (@TenantId, @OrganizationId, @CategoryId, @BrandId, @UnitId, @Sku, @Name, @Brand, @UnitPrice, @StockQty, @LowStockThreshold,
              @HsnCode, @Description, @Mrp, @PurchasePrice, @WholesalePrice, @MinWholesaleQty, @TaxRatePercent, @StorageLocation, @IsService,
              @Tags, @Manufacturer, @Barcode, @CountryOfOrigin, @InternalCode, @ManufacturerPartNo, @Visibility,
              @InventoryTrackingMode, @ProductNature, @AllowNegativeStock, @LeadTimeDays, @WarrantyMonths, @ShelfLifeDays,
              @IsReturnable, @ReorderQty, @MaxStock, @LowStockAlert);
            """;
        var ext = BuildExtendedWriteFields(request);
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<long>(
            new CommandDefinition(sql, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                CategoryId = request.CategoryId,
                BrandId = request.BrandId,
                UnitId = request.UnitId,
                request.Sku,
                request.Name,
                Brand = brandText,
                request.UnitPrice,
                StockQty = request.StockQty ?? 0,
                request.LowStockThreshold,
                HsnCode = TrimOrNull(request.HsnCode),
                Description = TrimOrNull(request.Description),
                request.Mrp,
                request.PurchasePrice,
                request.WholesalePrice,
                request.MinWholesaleQty,
                request.TaxRatePercent,
                StorageLocation = TrimOrNull(request.StorageLocation),
                IsService = request.IsService,
                ext.Tags,
                ext.Manufacturer,
                ext.Barcode,
                ext.CountryOfOrigin,
                ext.InternalCode,
                ext.ManufacturerPartNo,
                ext.Visibility,
                ext.InventoryTrackingMode,
                ext.ProductNature,
                ext.AllowNegativeStock,
                ext.LeadTimeDays,
                ext.WarrantyMonths,
                ext.ShelfLifeDays,
                ext.IsReturnable,
                ext.ReorderQty,
                ext.MaxStock,
                ext.LowStockAlert,
            }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<ProductDto>> ListAsync(bool activeOnly, int maxRows, CancellationToken ct)
    {
        var sql = activeOnly
            ? $"""
              SELECT TOP (@Max)
                p.ProductId, p.Sku, p.Name, COALESCE(pb.Name, p.Brand) AS Brand, p.BrandId,
                p.UnitPrice, p.StockQty, p.LowStockThreshold,
                p.CategoryId, pc.Name AS CategoryName, p.UnitId, pu.DisplayName AS UnitName,
                p.IsActive, img.PrimaryImageRelativePath, p.CreatedUtc,
                p.HsnCode, p.Description, p.Mrp, p.PurchasePrice, p.WholesalePrice, p.MinWholesaleQty, p.TaxRatePercent, p.StorageLocation, p.IsService,
                {ExtendedSelectColumns}
              FROM dbo.Products p
              LEFT JOIN dbo.ProductCategories pc ON pc.CategoryId = p.CategoryId
              LEFT JOIN dbo.ProductBrands pb ON pb.BrandId = p.BrandId
              LEFT JOIN dbo.ProductUnits pu ON pu.UnitId = p.UnitId
              OUTER APPLY (
                SELECT TOP (1) pi.RelativePath AS PrimaryImageRelativePath
                FROM dbo.ProductImages pi
                WHERE pi.ProductId = p.ProductId AND pi.TenantId = p.TenantId AND pi.OrganizationId = p.OrganizationId
                ORDER BY pi.IsPrimary DESC, pi.SortOrder ASC, pi.ProductImageId ASC
              ) img
              WHERE p.TenantId = @TenantId AND p.OrganizationId = @OrganizationId AND p.IsActive = 1
              ORDER BY p.ProductId DESC;
              """
            : $"""
              SELECT TOP (@Max)
                p.ProductId, p.Sku, p.Name, COALESCE(pb.Name, p.Brand) AS Brand, p.BrandId,
                p.UnitPrice, p.StockQty, p.LowStockThreshold,
                p.CategoryId, pc.Name AS CategoryName, p.UnitId, pu.DisplayName AS UnitName,
                p.IsActive, img.PrimaryImageRelativePath, p.CreatedUtc,
                p.HsnCode, p.Description, p.Mrp, p.PurchasePrice, p.WholesalePrice, p.MinWholesaleQty, p.TaxRatePercent, p.StorageLocation, p.IsService,
                {ExtendedSelectColumns}
              FROM dbo.Products p
              LEFT JOIN dbo.ProductCategories pc ON pc.CategoryId = p.CategoryId
              LEFT JOIN dbo.ProductBrands pb ON pb.BrandId = p.BrandId
              LEFT JOIN dbo.ProductUnits pu ON pu.UnitId = p.UnitId
              OUTER APPLY (
                SELECT TOP (1) pi.RelativePath AS PrimaryImageRelativePath
                FROM dbo.ProductImages pi
                WHERE pi.ProductId = p.ProductId AND pi.TenantId = p.TenantId AND pi.OrganizationId = p.OrganizationId
                ORDER BY pi.IsPrimary DESC, pi.SortOrder ASC, pi.ProductImageId ASC
              ) img
              WHERE p.TenantId = @TenantId AND p.OrganizationId = @OrganizationId
              ORDER BY p.ProductId DESC;
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
        var sql = $"""
            SELECT
              p.ProductId, p.Sku, p.Name, COALESCE(pb.Name, p.Brand) AS Brand, p.BrandId,
              p.UnitPrice, p.StockQty, p.LowStockThreshold,
              p.CategoryId, pc.Name AS CategoryName, p.UnitId, pu.DisplayName AS UnitName,
              p.IsActive, img.PrimaryImageRelativePath, p.CreatedUtc,
              p.HsnCode, p.Description, p.Mrp, p.PurchasePrice, p.WholesalePrice, p.MinWholesaleQty, p.TaxRatePercent, p.StorageLocation, p.IsService,
              {ExtendedSelectColumns}
            FROM dbo.Products p
            LEFT JOIN dbo.ProductCategories pc ON pc.CategoryId = p.CategoryId
            LEFT JOIN dbo.ProductBrands pb ON pb.BrandId = p.BrandId
            LEFT JOIN dbo.ProductUnits pu ON pu.UnitId = p.UnitId
            OUTER APPLY (
              SELECT TOP (1) pi.RelativePath AS PrimaryImageRelativePath
              FROM dbo.ProductImages pi
              WHERE pi.ProductId = p.ProductId AND pi.TenantId = p.TenantId AND pi.OrganizationId = p.OrganizationId
              ORDER BY pi.IsPrimary DESC, pi.SortOrder ASC, pi.ProductImageId ASC
            ) img
            WHERE p.ProductId = @ProductId AND p.TenantId = @TenantId AND p.OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<ProductDto>(
            new CommandDefinition(sql,
                new { ProductId = productId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<bool> UpdateAsync(long productId, UpdateProductRequest request, CancellationToken ct)
    {
        await EnsureCategoryScopeAsync(request.CategoryId, ct).ConfigureAwait(false);
        await EnsureBrandScopeAsync(request.BrandId, ct).ConfigureAwait(false);
        await EnsureUnitScopeAsync(request.UnitId, ct).ConfigureAwait(false);

        var brandText = string.IsNullOrWhiteSpace(request.Brand) ? null : request.Brand.Trim();
        if (request.BrandId.HasValue)
            brandText = await _brands.GetNameAsync(request.BrandId.Value, ct).ConfigureAwait(false);

        const string sql = """
            UPDATE dbo.Products
            SET CategoryId = @CategoryId, BrandId = @BrandId, UnitId = @UnitId, Sku = @Sku, Name = @Name, Brand = @Brand, UnitPrice = @UnitPrice,
                StockQty = @StockQty, LowStockThreshold = @LowStockThreshold, IsActive = @IsActive,
                HsnCode = @HsnCode, Description = @Description, Mrp = @Mrp, PurchasePrice = @PurchasePrice,
                WholesalePrice = @WholesalePrice, MinWholesaleQty = @MinWholesaleQty, TaxRatePercent = @TaxRatePercent,
                StorageLocation = @StorageLocation, IsService = @IsService,
                Tags = @Tags, Manufacturer = @Manufacturer, Barcode = @Barcode, CountryOfOrigin = @CountryOfOrigin,
                InternalCode = @InternalCode, ManufacturerPartNo = @ManufacturerPartNo, Visibility = @Visibility,
                InventoryTrackingMode = @InventoryTrackingMode, ProductNature = @ProductNature,
                AllowNegativeStock = @AllowNegativeStock, LeadTimeDays = @LeadTimeDays, WarrantyMonths = @WarrantyMonths,
                ShelfLifeDays = @ShelfLifeDays, IsReturnable = @IsReturnable, ReorderQty = @ReorderQty, MaxStock = @MaxStock,
                LowStockAlert = @LowStockAlert
            WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var write = BuildExtendedWriteFields(request);
        var n = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                ProductId = productId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.CategoryId,
                request.BrandId,
                request.UnitId,
                request.Sku,
                request.Name,
                Brand = brandText,
                request.UnitPrice,
                request.StockQty,
                request.LowStockThreshold,
                request.IsActive,
                HsnCode = TrimOrNull(request.HsnCode),
                Description = TrimOrNull(request.Description),
                request.Mrp,
                request.PurchasePrice,
                request.WholesalePrice,
                request.MinWholesaleQty,
                request.TaxRatePercent,
                StorageLocation = TrimOrNull(request.StorageLocation),
                request.IsService,
                write.Tags,
                write.Manufacturer,
                write.Barcode,
                write.CountryOfOrigin,
                write.InternalCode,
                write.ManufacturerPartNo,
                write.Visibility,
                write.InventoryTrackingMode,
                write.ProductNature,
                write.AllowNegativeStock,
                write.LeadTimeDays,
                write.WarrantyMonths,
                write.ShelfLifeDays,
                write.IsReturnable,
                write.ReorderQty,
                write.MaxStock,
                write.LowStockAlert,
            }, cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }

    public async Task<ProductBrowseResult> BrowseAsync(ProductBrowseQuery query, CancellationToken ct)
    {
        var sortKey = NormalizeSortKey(query.Sort);
        var hasSearch = !string.IsNullOrWhiteSpace(query.Search);
        var escaped = hasSearch ? EscapeLikePattern(query.Search!.Trim()) : string.Empty;
        var contains = hasSearch ? "%" + escaped + "%" : string.Empty;
        var prefix = hasSearch ? escaped + "%" : string.Empty;

        var orderBy = sortKey switch
        {
            "price_asc" => "p.UnitPrice ASC, p.ProductId",
            "price_desc" => "p.UnitPrice DESC, p.ProductId",
            "name_asc" => "p.Name ASC, p.ProductId",
            "name_desc" => "p.Name DESC, p.ProductId",
            "stock_asc" => "p.StockQty ASC, p.ProductId",
            "stock_desc" => "p.StockQty DESC, p.ProductId",
            "relevance" when hasSearch => "RelevanceSort ASC, p.Name ASC, p.ProductId",
            _ => "p.ProductId DESC",
        };

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);

        string sql;
        if (query.CategoryId is null)
        {
            sql = $"""
                SELECT
                  p.ProductId,
                  p.Sku,
                  p.Name,
                  COALESCE(pb.Name, p.Brand) AS Brand,
                  p.BrandId,
                  p.UnitPrice,
                  p.StockQty,
                  p.LowStockThreshold,
                  p.CategoryId,
                  pc.Name AS CategoryName,
                  p.UnitId,
                  pu.DisplayName AS UnitName,
                  p.IsActive,
                  img.PrimaryImageRelativePath,
                  p.CreatedUtc,
                  p.HsnCode,
                  p.Description,
                  p.Mrp,
                  p.PurchasePrice,
                  p.WholesalePrice,
                  p.MinWholesaleQty,
                  p.TaxRatePercent,
                  p.StorageLocation,
                  p.IsService,
                  {ExtendedSelectColumns},
                  COUNT(1) OVER() AS TotalCount,
                  CASE WHEN @HasSearch = 1 AND p.Name LIKE @Prefix ESCAPE '\' THEN 0 ELSE 1 END AS RelevanceSort
                FROM dbo.Products p
                LEFT JOIN dbo.ProductCategories pc ON pc.CategoryId = p.CategoryId
                LEFT JOIN dbo.ProductBrands pb ON pb.BrandId = p.BrandId
                LEFT JOIN dbo.ProductUnits pu ON pu.UnitId = p.UnitId
                OUTER APPLY (
                  SELECT TOP (1) pi.RelativePath AS PrimaryImageRelativePath
                  FROM dbo.ProductImages pi
                  WHERE pi.ProductId = p.ProductId AND pi.TenantId = p.TenantId AND pi.OrganizationId = p.OrganizationId
                  ORDER BY pi.IsPrimary DESC, pi.SortOrder ASC, pi.ProductImageId ASC
                ) img
                WHERE p.TenantId = @TenantId AND p.OrganizationId = @OrganizationId
                  AND (@HasSearch = 0 OR p.Name LIKE @Contains ESCAPE '\' OR ISNULL(p.Sku, N'') LIKE @Contains ESCAPE '\' OR ISNULL(COALESCE(pb.Name, p.Brand), N'') LIKE @Contains ESCAPE '\' OR ISNULL(p.HsnCode, N'') LIKE @Contains ESCAPE '\')
                  AND (@ActiveOnly = 0 OR p.IsActive = 1)
                  AND (@AlertsOnly = 0 OR p.StockQty <= 0 OR (p.LowStockThreshold IS NOT NULL AND p.StockQty <= p.LowStockThreshold))
                  AND (@FilterBrandId IS NULL OR p.BrandId = @FilterBrandId)
                  AND (@FilterUnitId IS NULL OR p.UnitId = @FilterUnitId)
                ORDER BY {orderBy}
                OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
                """;
        }
        else
        {
            sql = $"""
                ;WITH Subcats AS (
                  SELECT c.CategoryId
                  FROM dbo.ProductCategories c
                  WHERE c.TenantId = @TenantId AND c.OrganizationId = @OrganizationId
                    AND c.CategoryId = @FilterCategoryId AND c.IsActive = 1
                  UNION ALL
                  SELECT x.CategoryId
                  FROM dbo.ProductCategories x
                  INNER JOIN Subcats s ON x.ParentCategoryId = s.CategoryId
                  WHERE x.TenantId = @TenantId AND x.OrganizationId = @OrganizationId AND x.IsActive = 1
                )
                SELECT
                  p.ProductId,
                  p.Sku,
                  p.Name,
                  COALESCE(pb.Name, p.Brand) AS Brand,
                  p.BrandId,
                  p.UnitPrice,
                  p.StockQty,
                  p.LowStockThreshold,
                  p.CategoryId,
                  pc.Name AS CategoryName,
                  p.UnitId,
                  pu.DisplayName AS UnitName,
                  p.IsActive,
                  img.PrimaryImageRelativePath,
                  p.CreatedUtc,
                  p.HsnCode,
                  p.Description,
                  p.Mrp,
                  p.PurchasePrice,
                  p.WholesalePrice,
                  p.MinWholesaleQty,
                  p.TaxRatePercent,
                  p.StorageLocation,
                  p.IsService,
                  {ExtendedSelectColumns},
                  COUNT(1) OVER() AS TotalCount,
                  CASE WHEN @HasSearch = 1 AND p.Name LIKE @Prefix ESCAPE '\' THEN 0 ELSE 1 END AS RelevanceSort
                FROM dbo.Products p
                LEFT JOIN dbo.ProductCategories pc ON pc.CategoryId = p.CategoryId
                LEFT JOIN dbo.ProductBrands pb ON pb.BrandId = p.BrandId
                LEFT JOIN dbo.ProductUnits pu ON pu.UnitId = p.UnitId
                OUTER APPLY (
                  SELECT TOP (1) pi.RelativePath AS PrimaryImageRelativePath
                  FROM dbo.ProductImages pi
                  WHERE pi.ProductId = p.ProductId AND pi.TenantId = p.TenantId AND pi.OrganizationId = p.OrganizationId
                  ORDER BY pi.IsPrimary DESC, pi.SortOrder ASC, pi.ProductImageId ASC
                ) img
                WHERE p.TenantId = @TenantId AND p.OrganizationId = @OrganizationId
                  AND p.CategoryId IN (SELECT CategoryId FROM Subcats)
                  AND (@HasSearch = 0 OR p.Name LIKE @Contains ESCAPE '\' OR ISNULL(p.Sku, N'') LIKE @Contains ESCAPE '\' OR ISNULL(COALESCE(pb.Name, p.Brand), N'') LIKE @Contains ESCAPE '\' OR ISNULL(p.HsnCode, N'') LIKE @Contains ESCAPE '\')
                  AND (@ActiveOnly = 0 OR p.IsActive = 1)
                  AND (@AlertsOnly = 0 OR p.StockQty <= 0 OR (p.LowStockThreshold IS NOT NULL AND p.StockQty <= p.LowStockThreshold))
                  AND (@FilterBrandId IS NULL OR p.BrandId = @FilterBrandId)
                  AND (@FilterUnitId IS NULL OR p.UnitId = @FilterUnitId)
                ORDER BY {orderBy}
                OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
                """;
        }

        var rows = await conn.QueryAsync<ProductBrowseRow>(
            new CommandDefinition(sql,
                new
                {
                    TenantId = _wp.TenantId,
                    OrganizationId = _wp.OrganizationId,
                    FilterCategoryId = query.CategoryId,
                    FilterBrandId = query.BrandId,
                    FilterUnitId = query.UnitId,
                    HasSearch = hasSearch ? 1 : 0,
                    Contains = contains,
                    Prefix = prefix,
                    ActiveOnly = query.ActiveOnly ? 1 : 0,
                    AlertsOnly = query.AlertsOnly ? 1 : 0,
                    query.Skip,
                    query.Take,
                }, cancellationToken: ct)).ConfigureAwait(false);

        var list = rows.AsList();
        var total = list.Count > 0 ? list[0].TotalCount : 0;
        var items = list.Select(MapBrowseRow).ToList();

        return new ProductBrowseResult(items, total);
    }

    public async Task<ProductInventorySummaryDto> GetInventorySummaryAsync(CancellationToken ct)
    {
        const string sql = """
            SELECT
              COUNT(*) AS TotalSkus,
              ISNULL(SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END), 0) AS ActiveSkus,
              ISNULL(SUM(CASE WHEN StockQty <= 0 THEN 1 ELSE 0 END), 0) AS OutOfStockCount,
              ISNULL(SUM(CASE WHEN LowStockThreshold IS NOT NULL AND StockQty > 0 AND StockQty <= LowStockThreshold THEN 1 ELSE 0 END), 0) AS LowStockAlertCount,
              ISNULL(SUM(UnitPrice * StockQty), 0) AS InventoryValueAtRetail
            FROM dbo.Products
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<ProductInventorySummaryDto>(
            new CommandDefinition(sql, new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    private async Task EnsureCategoryScopeAsync(long? categoryId, CancellationToken ct)
    {
        if (!categoryId.HasValue)
            return;
        const string sql = """
            SELECT COUNT(1) FROM dbo.ProductCategories
            WHERE CategoryId = @CategoryId AND TenantId = @TenantId AND OrganizationId = @OrganizationId AND IsActive = 1;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var ok = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql,
                new { CategoryId = categoryId.Value, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId },
                cancellationToken: ct)).ConfigureAwait(false);
        if (ok == 0)
            throw new InvalidOperationException("Category not found or inactive for this organization.");
    }

    private async Task EnsureBrandScopeAsync(long? brandId, CancellationToken ct)
    {
        if (!brandId.HasValue)
            return;
        const string sql = """
            SELECT COUNT(1) FROM dbo.ProductBrands
            WHERE BrandId = @BrandId AND TenantId = @TenantId AND OrganizationId = @OrganizationId AND IsActive = 1;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var ok = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql,
                new { BrandId = brandId.Value, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId },
                cancellationToken: ct)).ConfigureAwait(false);
        if (ok == 0)
            throw new InvalidOperationException("Brand not found or inactive for this organization.");
    }

    private async Task EnsureUnitScopeAsync(long? unitId, CancellationToken ct)
    {
        if (!unitId.HasValue)
            return;
        const string sql = """
            SELECT COUNT(1) FROM dbo.ProductUnits
            WHERE UnitId = @UnitId AND TenantId = @TenantId AND OrganizationId = @OrganizationId AND IsActive = 1;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var ok = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql,
                new { UnitId = unitId.Value, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId },
                cancellationToken: ct)).ConfigureAwait(false);
        if (ok == 0)
            throw new InvalidOperationException("Unit of measure not found or inactive for this organization.");
    }

    private static string NormalizeSortKey(string? sort)
    {
        var s = (sort ?? string.Empty).Trim().ToLowerInvariant();
        return s switch
        {
            "price_asc" => "price_asc",
            "price_desc" => "price_desc",
            "name_asc" => "name_asc",
            "name_desc" => "name_desc",
            "stock_asc" => "stock_asc",
            "stock_desc" => "stock_desc",
            "relevance" => "relevance",
            "newest" => "newest",
            _ => "newest",
        };
    }

    /// <summary>Escape LIKE wildcards for SQL Server WITH ESCAPE '\'.</summary>
    private static string EscapeLikePattern(string raw)
    {
        return raw.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal)
            .Replace("[", "\\[", StringComparison.Ordinal);
    }

    private sealed class ProductBrowseRow
    {
        public long ProductId { get; init; }
        public string? Sku { get; init; }
        public string Name { get; init; } = "";
        public string? Brand { get; init; }
        public long? BrandId { get; init; }
        public decimal UnitPrice { get; init; }
        public decimal StockQty { get; init; }
        public decimal? LowStockThreshold { get; init; }
        public long? CategoryId { get; init; }
        public string? CategoryName { get; init; }
        public long? UnitId { get; init; }
        public string? UnitName { get; init; }
        public bool IsActive { get; init; }
        public string? PrimaryImageRelativePath { get; init; }
        public DateTime CreatedUtc { get; init; }
        public string? HsnCode { get; init; }
        public string? Description { get; init; }
        public decimal? Mrp { get; init; }
        public decimal? PurchasePrice { get; init; }
        public decimal? WholesalePrice { get; init; }
        public decimal? MinWholesaleQty { get; init; }
        public decimal? TaxRatePercent { get; init; }
        public string? StorageLocation { get; init; }
        public bool IsService { get; init; }
        public string? Tags { get; init; }
        public string? Manufacturer { get; init; }
        public string? Barcode { get; init; }
        public string? CountryOfOrigin { get; init; }
        public string? InternalCode { get; init; }
        public string? ManufacturerPartNo { get; init; }
        public string? Visibility { get; init; }
        public string? InventoryTrackingMode { get; init; }
        public string? ProductNature { get; init; }
        public bool HasVariants { get; init; }
        public bool AllowNegativeStock { get; init; }
        public int? LeadTimeDays { get; init; }
        public int? WarrantyMonths { get; init; }
        public int? ShelfLifeDays { get; init; }
        public bool IsReturnable { get; init; }
        public decimal? ReorderQty { get; init; }
        public decimal? MaxStock { get; init; }
        public bool LowStockAlert { get; init; }
        public int TotalCount { get; init; }
    }

    private static ProductDto MapBrowseRow(ProductBrowseRow r) => new(
        r.ProductId,
        r.Sku,
        r.Name,
        r.Brand,
        r.BrandId,
        r.UnitPrice,
        r.StockQty,
        r.LowStockThreshold,
        r.CategoryId,
        r.CategoryName,
        r.UnitId,
        r.UnitName,
        r.IsActive,
        r.PrimaryImageRelativePath,
        r.CreatedUtc,
        r.HsnCode,
        r.Description,
        r.Mrp,
        r.PurchasePrice,
        r.WholesalePrice,
        r.MinWholesaleQty,
        r.TaxRatePercent,
        r.StorageLocation,
        r.IsService,
        r.Tags,
        r.Manufacturer,
        r.Barcode,
        r.CountryOfOrigin,
        r.InternalCode,
        r.ManufacturerPartNo,
        r.Visibility,
        r.InventoryTrackingMode,
        r.ProductNature,
        r.HasVariants,
        r.AllowNegativeStock,
        r.LeadTimeDays,
        r.WarrantyMonths,
        r.ShelfLifeDays,
        r.IsReturnable,
        r.ReorderQty,
        r.MaxStock,
        r.LowStockAlert);

    private sealed record ExtendedWriteFields(
        string? Tags,
        string? Manufacturer,
        string? Barcode,
        string? CountryOfOrigin,
        string? InternalCode,
        string? ManufacturerPartNo,
        string? Visibility,
        string InventoryTrackingMode,
        string ProductNature,
        bool AllowNegativeStock,
        int? LeadTimeDays,
        int? WarrantyMonths,
        int? ShelfLifeDays,
        bool IsReturnable,
        decimal? ReorderQty,
        decimal? MaxStock,
        bool LowStockAlert);

    private static ExtendedWriteFields BuildExtendedWriteFields(CreateProductRequest request) => new(
        TrimOrNull(request.Tags),
        TrimOrNull(request.Manufacturer),
        TrimOrNull(request.Barcode),
        TrimOrNull(request.CountryOfOrigin),
        TrimOrNull(request.InternalCode),
        TrimOrNull(request.ManufacturerPartNo),
        TrimOrNull(request.Visibility),
        string.IsNullOrWhiteSpace(request.InventoryTrackingMode) ? "Quantity" : request.InventoryTrackingMode.Trim(),
        string.IsNullOrWhiteSpace(request.ProductNature) ? (request.IsService ? "Service" : "Physical") : request.ProductNature.Trim(),
        request.AllowNegativeStock,
        request.LeadTimeDays,
        request.WarrantyMonths,
        request.ShelfLifeDays,
        request.IsReturnable,
        request.ReorderQty,
        request.MaxStock,
        request.LowStockAlert);

    private static ExtendedWriteFields BuildExtendedWriteFields(UpdateProductRequest request) => new(
        TrimOrNull(request.Tags),
        TrimOrNull(request.Manufacturer),
        TrimOrNull(request.Barcode),
        TrimOrNull(request.CountryOfOrigin),
        TrimOrNull(request.InternalCode),
        TrimOrNull(request.ManufacturerPartNo),
        TrimOrNull(request.Visibility),
        string.IsNullOrWhiteSpace(request.InventoryTrackingMode) ? "Quantity" : request.InventoryTrackingMode.Trim(),
        string.IsNullOrWhiteSpace(request.ProductNature) ? (request.IsService ? "Service" : "Physical") : request.ProductNature.Trim(),
        request.AllowNegativeStock,
        request.LeadTimeDays,
        request.WarrantyMonths,
        request.ShelfLifeDays,
        request.IsReturnable,
        request.ReorderQty,
        request.MaxStock,
        request.LowStockAlert);

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
