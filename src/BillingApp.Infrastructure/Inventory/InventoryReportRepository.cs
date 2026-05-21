using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Inventory;
using Dapper;

namespace BillingApp.Infrastructure.Inventory;

public sealed class InventoryReportRepository : IInventoryReportRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public InventoryReportRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<StockSummaryReport> StockSummaryAsync(long? warehouseId, long? categoryId, string? search, CancellationToken ct)
    {
        const string sql = """
            WITH balances AS (
              SELECT v.ProductVariantId, p.ProductId, p.Name AS ProductName, v.Sku, c.Name AS CategoryName,
                     ib.WarehouseId, w.Name AS WarehouseName,
                     SUM(ib.OnHandQty) AS OnHandQty,
                     SUM(ib.ReservedQty) AS ReservedQty,
                     SUM(ib.OnHandQty - ib.ReservedQty - ib.DamagedQty) AS AvailableQty,
                     SUM(ib.DamagedQty) AS DamagedQty,
                     AVG(ib.AverageCost) AS AverageCost,
                     SUM(ib.OnHandQty * COALESCE(ib.AverageCost, p.PurchasePrice, 0)) AS InventoryValueAtCost,
                     p.LowStockThreshold
              FROM dbo.InventoryBalances ib
              INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = ib.ProductVariantId
              INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
              INNER JOIN dbo.Warehouses w ON w.WarehouseId = ib.WarehouseId
              LEFT JOIN dbo.ProductCategories c ON c.CategoryId = p.CategoryId
              WHERE ib.TenantId = @TenantId AND ib.OrganizationId = @OrganizationId
                AND v.IsDeleted = 0
                AND (@WarehouseId IS NULL OR ib.WarehouseId = @WarehouseId)
                AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
                AND (@Search IS NULL OR p.Name LIKE @Like OR v.Sku LIKE @Like)
              GROUP BY v.ProductVariantId, p.ProductId, p.Name, v.Sku, c.Name, ib.WarehouseId, w.Name, p.LowStockThreshold
            )
            SELECT
              ProductId, ProductVariantId, ProductName, Sku, CategoryName,
              WarehouseName, WarehouseId,
              OnHandQty, ReservedQty, AvailableQty, DamagedQty,
              AverageCost, InventoryValueAtCost,
              CASE
                WHEN AvailableQty <= 0 THEN N'OutOfStock'
                WHEN LowStockThreshold IS NOT NULL AND AvailableQty <= LowStockThreshold THEN N'LowStock'
                ELSE N'InStock'
              END AS StockStatus
            FROM balances
            ORDER BY ProductName, WarehouseName;
            """;
        var like = string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim()}%";
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = (await conn.QueryAsync<StockSummaryReportRow>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            WarehouseId = warehouseId,
            CategoryId = categoryId,
            Search = like,
            Like = like,
        }, cancellationToken: ct)).ConfigureAwait(false)).AsList();

        var totalValue = rows.Sum(r => r.InventoryValueAtCost);
        var inStock = rows.Count(r => r.StockStatus == "InStock");
        var low = rows.Count(r => r.StockStatus == "LowStock");
        var oos = rows.Count(r => r.StockStatus == "OutOfStock");
        return new StockSummaryReport(rows, totalValue, rows.Count, inStock, low, oos);
    }

    public async Task<IReadOnlyList<LowStockReportRow>> LowStockAsync(long? warehouseId, CancellationToken ct)
    {
        const string sql = """
            SELECT p.ProductId, v.ProductVariantId, p.Name AS ProductName, v.Sku, c.Name AS CategoryName,
                   ib.WarehouseId, w.Name AS WarehouseName,
                   (ib.OnHandQty - ib.ReservedQty - ib.DamagedQty) AS AvailableQty,
                   p.LowStockThreshold,
                   CASE
                     WHEN (ib.OnHandQty - ib.ReservedQty - ib.DamagedQty) <= 0 THEN N'Critical'
                     WHEN p.LowStockThreshold IS NOT NULL AND (ib.OnHandQty - ib.ReservedQty - ib.DamagedQty) <= p.LowStockThreshold / 2 THEN N'High'
                     ELSE N'Medium'
                   END AS Severity
            FROM dbo.InventoryBalances ib
            INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = ib.ProductVariantId
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            INNER JOIN dbo.Warehouses w ON w.WarehouseId = ib.WarehouseId
            LEFT JOIN dbo.ProductCategories c ON c.CategoryId = p.CategoryId
            WHERE ib.TenantId = @TenantId AND ib.OrganizationId = @OrganizationId
              AND v.IsDeleted = 0
              AND (@WarehouseId IS NULL OR ib.WarehouseId = @WarehouseId)
              AND p.LowStockThreshold IS NOT NULL
              AND (ib.OnHandQty - ib.ReservedQty - ib.DamagedQty) <= p.LowStockThreshold
            ORDER BY AvailableQty ASC, p.Name ASC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<LowStockReportRow>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            WarehouseId = warehouseId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<ExpiryFefoReportRow>> ExpiryFefoAsync(long? warehouseId, int? daysWindow, CancellationToken ct)
    {
        const string sql = """
            DECLARE @Today DATETIME2 = SYSUTCDATETIME();
            DECLARE @Win DATETIME2 = CASE WHEN @Days IS NULL THEN DATEADD(YEAR, 2, @Today) ELSE DATEADD(DAY, @Days, @Today) END;

            SELECT b.BatchId, b.ProductVariantId, p.Name AS ProductName, v.Sku,
                   b.BatchNumber,
                   w.Name AS WarehouseName,
                   b.ExpiryDate,
                   DATEDIFF(DAY, @Today, b.ExpiryDate) AS DaysToExpiry,
                   CASE
                     WHEN b.ExpiryDate IS NULL THEN N'NoExpiry'
                     WHEN b.ExpiryDate < @Today THEN N'Expired'
                     WHEN b.ExpiryDate <= DATEADD(DAY, 7, @Today) THEN N'Critical'
                     WHEN b.ExpiryDate <= DATEADD(DAY, 30, @Today) THEN N'Soon'
                     ELSE N'Healthy'
                   END AS ExpiryStatus,
                   ISNULL(ib.OnHandQty, 0) AS OnHandQty,
                   b.CostPerUnit AS UnitCost,
                   ISNULL(ib.OnHandQty, 0) * COALESCE(b.CostPerUnit, 0) AS TotalValueAtRisk
            FROM dbo.Batches b
            INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = b.ProductVariantId
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            LEFT JOIN dbo.InventoryBalances ib ON ib.BatchId = b.BatchId
                AND (@WarehouseId IS NULL OR ib.WarehouseId = @WarehouseId)
            LEFT JOIN dbo.Warehouses w ON w.WarehouseId = ib.WarehouseId
            WHERE b.TenantId = @TenantId AND b.OrganizationId = @OrganizationId AND b.IsDeleted = 0
              AND (b.ExpiryDate IS NULL OR b.ExpiryDate <= @Win)
            ORDER BY b.ExpiryDate ASC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<ExpiryFefoReportRow>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            WarehouseId = warehouseId,
            Days = daysWindow,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<SerialTraceReportRow>> SerialTraceAsync(string? search, long? productVariantId, string? status, CancellationToken ct)
    {
        const string sql = """
            SELECT s.ProductSerialId, s.SerialNumber, p.Name AS ProductName, v.Sku, s.Status,
                   s.PurchaseLineId,
                   pl.PurchaseBillId, pb.PurchaseNumber AS PurchaseInvoiceNumber, pb.ReceivedUtc AS PurchaseDateUtc,
                   s.PurchaseCostPerUnit,
                   s.SoldInvoiceLineId, il.InvoiceId AS SoldInvoiceId,
                   inv.InvoiceNumber AS SoldInvoiceNumber, inv.IssueUtc AS SoldDateUtc,
                   il.UnitPrice AS SellingPrice,
                   (il.UnitPrice - s.PurchaseCostPerUnit) AS GrossProfit,
                   w.Name AS WarehouseName
            FROM dbo.ProductSerials s
            INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = s.ProductVariantId
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            LEFT JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId = s.PurchaseLineId
            LEFT JOIN dbo.PurchaseBills pb ON pb.PurchaseBillId = pl.PurchaseBillId
            LEFT JOIN dbo.InvoiceLines il ON il.InvoiceLineId = s.SoldInvoiceLineId
            LEFT JOIN dbo.Invoices inv ON inv.InvoiceId = il.InvoiceId
            LEFT JOIN dbo.Warehouses w ON w.WarehouseId = s.WarehouseId
            WHERE s.TenantId = @TenantId AND s.OrganizationId = @OrganizationId AND s.IsDeleted = 0
              AND (@VariantId IS NULL OR s.ProductVariantId = @VariantId)
              AND (@Status IS NULL OR s.Status = @Status)
              AND (@Search IS NULL OR s.SerialNumber LIKE @Like OR s.Imei1 LIKE @Like OR p.Name LIKE @Like OR v.Sku LIKE @Like)
            ORDER BY s.CreatedUtc DESC;
            """;
        var like = string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim()}%";
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<SerialTraceReportRow>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            VariantId = productVariantId,
            Status = string.IsNullOrWhiteSpace(status) ? null : status.Trim(),
            Search = like,
            Like = like,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<ItemProfitReportRow>> ItemProfitAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct)
    {
        const string sql = """
            SELECT p.ProductId,
                   COALESCE(p.DefaultVariantId, 0) AS ProductVariantId,
                   p.Name AS ProductName, p.Sku,
                   ISNULL(SUM(il.Quantity), 0) AS QuantitySold,
                   ISNULL(SUM(il.LineTotal), 0) AS TotalRevenue,
                   ISNULL(SUM(il.Quantity * COALESCE(p.PurchasePrice, 0)), 0) AS TotalCost,
                   ISNULL(SUM(il.LineTotal - il.Quantity * COALESCE(p.PurchasePrice, 0)), 0) AS GrossProfit,
                   CASE WHEN ISNULL(SUM(il.LineTotal), 0) = 0 THEN 0
                        ELSE 100.0 * (ISNULL(SUM(il.LineTotal - il.Quantity * COALESCE(p.PurchasePrice, 0)), 0)
                                       / NULLIF(ISNULL(SUM(il.LineTotal), 0), 0))
                   END AS GrossMarginPercent
            FROM dbo.Invoices inv
            INNER JOIN dbo.InvoiceLines il ON il.InvoiceId = inv.InvoiceId
            INNER JOIN dbo.Products p ON p.ProductId = il.ProductId
            WHERE p.TenantId = @TenantId AND p.OrganizationId = @OrganizationId
              AND inv.Status = N'Posted'
              AND (@FromUtc IS NULL OR inv.IssueUtc >= @FromUtc)
              AND (@ToUtc IS NULL OR inv.IssueUtc < @ToUtc)
            GROUP BY p.ProductId, p.DefaultVariantId, p.Name, p.Sku
            ORDER BY GrossProfit DESC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<ItemProfitReportRow>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            FromUtc = fromUtc,
            ToUtc = toUtc,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<InventoryValuationReportRow>> ValuationAsync(long? warehouseId, long? categoryId, string costingMethod, CancellationToken ct)
    {
        // For phase 1, value = OnHandQty * (AverageCost ?? PurchasePrice). Costing method is reported
        // back as-is so the UI can label it; FIFO/standard-cost engines plug in later.
        const string sql = """
            SELECT p.ProductId, v.ProductVariantId, p.Name AS ProductName, v.Sku, c.Name AS CategoryName,
                   ib.WarehouseId, w.Name AS WarehouseName,
                   ib.OnHandQty,
                   COALESCE(ib.AverageCost, p.PurchasePrice) AS AverageCost,
                   ib.OnHandQty * COALESCE(ib.AverageCost, p.PurchasePrice, 0) AS TotalValue,
                   DATEDIFF(DAY, p.CreatedUtc, SYSUTCDATETIME()) AS AgeDays,
                   CASE
                     WHEN DATEDIFF(DAY, p.CreatedUtc, SYSUTCDATETIME()) <= 30 THEN N'0-30'
                     WHEN DATEDIFF(DAY, p.CreatedUtc, SYSUTCDATETIME()) <= 90 THEN N'31-90'
                     ELSE N'90+'
                   END AS AgeBucket
            FROM dbo.InventoryBalances ib
            INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = ib.ProductVariantId
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            INNER JOIN dbo.Warehouses w ON w.WarehouseId = ib.WarehouseId
            LEFT JOIN dbo.ProductCategories c ON c.CategoryId = p.CategoryId
            WHERE ib.TenantId = @TenantId AND ib.OrganizationId = @OrganizationId
              AND v.IsDeleted = 0
              AND (@WarehouseId IS NULL OR ib.WarehouseId = @WarehouseId)
              AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
              AND ib.OnHandQty > 0
            ORDER BY TotalValue DESC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<InventoryValuationReportRow>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            WarehouseId = warehouseId,
            CategoryId = categoryId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }
}
