using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Inventory;
using Dapper;

namespace BillingApp.Infrastructure.Inventory;

public sealed class BatchRepository : IBatchRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public BatchRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<long> CreateAsync(CreateBatchRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.BatchNumber))
            throw new InvalidOperationException("BatchNumber is required.");

        const string sql = """
            INSERT INTO dbo.Batches (
                TenantId, OrganizationId, ProductVariantId, BatchNumber, LotNumber,
                ManufacturingDate, ExpiryDate, QualityStatus, CostPerUnit, SupplierPartyId, Notes)
            OUTPUT INSERTED.BatchId
            VALUES (@TenantId, @OrganizationId, @ProductVariantId, @BatchNumber, @LotNumber,
                @ManufacturingDate, @ExpiryDate, @QualityStatus, @CostPerUnit, @SupplierPartyId, @Notes);
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<long>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            request.ProductVariantId,
            BatchNumber = request.BatchNumber.Trim(),
            LotNumber = NullIfBlank(request.LotNumber),
            request.ManufacturingDate,
            request.ExpiryDate,
            QualityStatus = string.IsNullOrWhiteSpace(request.QualityStatus) ? "Released" : request.QualityStatus.Trim(),
            request.CostPerUnit,
            request.SupplierPartyId,
            Notes = NullIfBlank(request.Notes),
        }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<BatchDto?> GetAsync(long batchId, CancellationToken ct)
    {
        const string sql = """
            SELECT b.BatchId, b.ProductVariantId, COALESCE(v.DisplayName, p.Name) AS VariantDisplay, v.Sku,
                   b.BatchNumber, b.LotNumber, b.ManufacturingDate, b.ExpiryDate, b.QualityStatus,
                   b.CostPerUnit, b.SupplierPartyId, party.DisplayName AS SupplierName,
                   b.Notes, b.IsActive, b.CreatedUtc
            FROM dbo.Batches b
            INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = b.ProductVariantId
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            LEFT JOIN dbo.Parties party ON party.PartyId = b.SupplierPartyId
            WHERE b.BatchId = @Id AND b.TenantId = @TenantId AND b.OrganizationId = @OrganizationId AND b.IsDeleted = 0;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<BatchDto>(new CommandDefinition(sql, new
        {
            Id = batchId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<BatchBrowseResult> BrowseAsync(BatchBrowseQuery query, CancellationToken ct)
    {
        const string sql = """
            WITH src AS (
              SELECT b.BatchId, b.ProductVariantId, COALESCE(v.DisplayName, p.Name) AS VariantDisplay, v.Sku,
                     b.BatchNumber, b.LotNumber, b.ManufacturingDate, b.ExpiryDate, b.QualityStatus,
                     b.CostPerUnit, b.SupplierPartyId, party.DisplayName AS SupplierName,
                     b.Notes, b.IsActive, b.CreatedUtc
              FROM dbo.Batches b
              INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = b.ProductVariantId
              INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
              LEFT JOIN dbo.Parties party ON party.PartyId = b.SupplierPartyId
              WHERE b.TenantId = @TenantId AND b.OrganizationId = @OrganizationId
                AND b.IsDeleted = 0
                AND (@VariantId IS NULL OR b.ProductVariantId = @VariantId)
                AND (@QualityStatus IS NULL OR b.QualityStatus = @QualityStatus)
                AND (@ExpiryBefore IS NULL OR (b.ExpiryDate IS NOT NULL AND b.ExpiryDate <= @ExpiryBefore))
                AND (@Search IS NULL OR p.Name LIKE @Like OR v.Sku LIKE @Like OR b.BatchNumber LIKE @Like OR b.LotNumber LIKE @Like)
            )
            SELECT * FROM src
            ORDER BY ExpiryDate ASC, CreatedUtc DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;

            SELECT COUNT(1) FROM (
              SELECT 1 AS one FROM dbo.Batches b
              INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = b.ProductVariantId
              INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
              WHERE b.TenantId = @TenantId AND b.OrganizationId = @OrganizationId
                AND b.IsDeleted = 0
                AND (@VariantId IS NULL OR b.ProductVariantId = @VariantId)
                AND (@QualityStatus IS NULL OR b.QualityStatus = @QualityStatus)
                AND (@ExpiryBefore IS NULL OR (b.ExpiryDate IS NOT NULL AND b.ExpiryDate <= @ExpiryBefore))
                AND (@Search IS NULL OR p.Name LIKE @Like OR v.Sku LIKE @Like OR b.BatchNumber LIKE @Like OR b.LotNumber LIKE @Like)
            ) c;
            """;
        var like = string.IsNullOrWhiteSpace(query.Search) ? null : $"%{query.Search.Trim()}%";
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        using var grid = await conn.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            VariantId = query.ProductVariantId,
            QualityStatus = NullIfBlank(query.QualityStatus),
            ExpiryBefore = query.ExpiryBeforeUtc,
            Search = like,
            Like = like,
            Skip = Math.Max(0, query.Skip),
            Take = Math.Clamp(query.Take, 1, 200),
        }, cancellationToken: ct)).ConfigureAwait(false);
        var rows = (await grid.ReadAsync<BatchDto>().ConfigureAwait(false)).AsList();
        var total = await grid.ReadSingleAsync<int>().ConfigureAwait(false);
        return new BatchBrowseResult(rows, total);
    }

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

public sealed class ProductSerialRepository : IProductSerialRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public ProductSerialRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<long> CreateAsync(CreateProductSerialRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.SerialNumber))
            throw new InvalidOperationException("SerialNumber is required.");
        const string sql = """
            INSERT INTO dbo.ProductSerials (
                TenantId, OrganizationId, ProductVariantId, SerialNumber, Imei1, Imei2,
                WarehouseId, BatchId, PurchaseCostPerUnit, WarrantyStartUtc, WarrantyEndUtc, Notes, Status)
            OUTPUT INSERTED.ProductSerialId
            VALUES (@TenantId, @OrganizationId, @ProductVariantId, @SerialNumber, @Imei1, @Imei2,
                @WarehouseId, @BatchId, @PurchaseCostPerUnit, @WarrantyStartUtc, @WarrantyEndUtc, @Notes, N'Available');
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<long>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            request.ProductVariantId,
            SerialNumber = request.SerialNumber.Trim(),
            Imei1 = NullIfBlank(request.Imei1),
            Imei2 = NullIfBlank(request.Imei2),
            request.WarehouseId,
            request.BatchId,
            request.PurchaseCostPerUnit,
            request.WarrantyStartUtc,
            request.WarrantyEndUtc,
            Notes = NullIfBlank(request.Notes),
        }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<ProductSerialDto?> GetAsync(long productSerialId, CancellationToken ct)
    {
        const string sql = """
            SELECT s.ProductSerialId, s.ProductVariantId, COALESCE(v.DisplayName, p.Name) AS VariantDisplay, v.Sku,
                   s.SerialNumber, s.Imei1, s.Imei2,
                   s.WarehouseId, w.Name AS WarehouseName, s.BatchId, b.BatchNumber,
                   s.PurchaseCostPerUnit, s.Status, s.SoldInvoiceLineId,
                   s.WarrantyStartUtc, s.WarrantyEndUtc, s.Notes, s.CreatedUtc
            FROM dbo.ProductSerials s
            INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = s.ProductVariantId
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            LEFT JOIN dbo.Warehouses w ON w.WarehouseId = s.WarehouseId
            LEFT JOIN dbo.Batches b ON b.BatchId = s.BatchId
            WHERE s.ProductSerialId = @Id AND s.TenantId = @TenantId AND s.OrganizationId = @OrganizationId AND s.IsDeleted = 0;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<ProductSerialDto>(new CommandDefinition(sql, new
        {
            Id = productSerialId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<SerialBrowseResult> BrowseAsync(SerialBrowseQuery query, CancellationToken ct)
    {
        const string sql = """
            WITH src AS (
              SELECT s.ProductSerialId, s.ProductVariantId, COALESCE(v.DisplayName, p.Name) AS VariantDisplay, v.Sku,
                     s.SerialNumber, s.Imei1, s.Imei2,
                     s.WarehouseId, w.Name AS WarehouseName, s.BatchId, b.BatchNumber,
                     s.PurchaseCostPerUnit, s.Status, s.SoldInvoiceLineId,
                     s.WarrantyStartUtc, s.WarrantyEndUtc, s.Notes, s.CreatedUtc
              FROM dbo.ProductSerials s
              INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = s.ProductVariantId
              INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
              LEFT JOIN dbo.Warehouses w ON w.WarehouseId = s.WarehouseId
              LEFT JOIN dbo.Batches b ON b.BatchId = s.BatchId
              WHERE s.TenantId = @TenantId AND s.OrganizationId = @OrganizationId AND s.IsDeleted = 0
                AND (@ProductId IS NULL OR v.ProductId = @ProductId)
                AND (@VariantId IS NULL OR s.ProductVariantId = @VariantId)
                AND (@WarehouseId IS NULL OR s.WarehouseId = @WarehouseId)
                AND (@Status IS NULL OR s.Status = @Status)
                AND (@Search IS NULL OR s.SerialNumber LIKE @Like OR s.Imei1 LIKE @Like OR s.Imei2 LIKE @Like OR p.Name LIKE @Like OR v.Sku LIKE @Like)
            )
            SELECT * FROM src
            ORDER BY CreatedUtc DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;

            SELECT COUNT(1) FROM (
              SELECT 1 AS one FROM dbo.ProductSerials s
              INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = s.ProductVariantId
              INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
              WHERE s.TenantId = @TenantId AND s.OrganizationId = @OrganizationId AND s.IsDeleted = 0
                AND (@VariantId IS NULL OR s.ProductVariantId = @VariantId)
                AND (@WarehouseId IS NULL OR s.WarehouseId = @WarehouseId)
                AND (@Status IS NULL OR s.Status = @Status)
                AND (@Search IS NULL OR s.SerialNumber LIKE @Like OR s.Imei1 LIKE @Like OR s.Imei2 LIKE @Like OR p.Name LIKE @Like OR v.Sku LIKE @Like)
            ) c;
            """;
        var like = string.IsNullOrWhiteSpace(query.Search) ? null : $"%{query.Search.Trim()}%";
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        using var grid = await conn.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            ProductId = query.ProductId,
            VariantId = query.ProductVariantId,
            WarehouseId = query.WarehouseId,
            Status = NullIfBlank(query.Status),
            Search = like,
            Like = like,
            Skip = Math.Max(0, query.Skip),
            Take = Math.Clamp(query.Take, 1, 200),
        }, cancellationToken: ct)).ConfigureAwait(false);
        var rows = (await grid.ReadAsync<ProductSerialDto>().ConfigureAwait(false)).AsList();
        var total = await grid.ReadSingleAsync<int>().ConfigureAwait(false);
        return new SerialBrowseResult(rows, total);
    }

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
