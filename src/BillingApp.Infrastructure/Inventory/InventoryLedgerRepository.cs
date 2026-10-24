using System.Data;
using System.Data.Common;
using System.Text.Json;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Inventory;
using Dapper;

namespace BillingApp.Infrastructure.Inventory;

/// <summary>
/// Append-only ledger writer + balance snapshot updater.
///
/// Invariants enforced:
///   1. <see cref="PostInventoryTransactionRequest.IdempotencyKey"/> is honoured via a unique
///      filtered index — duplicates return the existing transaction id instead of double-posting.
///   2. The matching <c>InventoryBalances</c> row is locked with <c>UPDLOCK, HOLDLOCK</c>
///      inside the same DB transaction as the ledger insert — concurrent writers serialize.
///   3. Quantity buckets (<c>Available / Reserved / Damaged / Incoming / InTransit</c>) are
///      updated based on the transaction type + bucket so reservations don't collide with
///      physical on-hand counts.
/// </summary>
public sealed class InventoryLedgerRepository : IInventoryRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public InventoryLedgerRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<long> PostTransactionAsync(PostInventoryTransactionRequest request, CancellationToken ct)
    {
        ValidateRequest(request);

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            var id = await PostTransactionInternalAsync(conn, tx, request, actor: null, ct).ConfigureAwait(false);
            await tx.CommitAsync(ct).ConfigureAwait(false);
            return id;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    private async Task<long> PostTransactionInternalAsync(DbConnection conn, DbTransaction tx, PostInventoryTransactionRequest request, string? actor, CancellationToken ct)
    {
        // 1. Idempotency short-circuit (without acquiring locks).
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            const string existsSql = """
                SELECT TOP 1 InventoryTransactionId FROM dbo.InventoryTransactions
                WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND IdempotencyKey = @Key;
                """;
            var prior = await conn.ExecuteScalarAsync<long?>(new CommandDefinition(existsSql, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                Key = request.IdempotencyKey.Trim(),
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (prior.HasValue)
                return prior.Value;
        }

        // 2. Lock the matching balance row (or null-batch row).
        const string lockBalance = """
            SELECT InventoryBalanceId, OnHandQty, ReservedQty, DamagedQty, IncomingQty, InTransitQty
            FROM dbo.InventoryBalances WITH (UPDLOCK, HOLDLOCK)
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
              AND ProductVariantId = @ProductVariantId
              AND WarehouseId = @WarehouseId
              AND ISNULL(BatchId, 0) = ISNULL(@BatchId, 0);
            """;
        var balance = await conn.QuerySingleOrDefaultAsync<BalanceRow>(new CommandDefinition(lockBalance, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            request.ProductVariantId,
            request.WarehouseId,
            request.BatchId,
        }, tx, cancellationToken: ct)).ConfigureAwait(false);

        if (balance is null)
        {
            // Insert a zero-row first so the lock takes effect on the next pass.
            const string insertZero = """
                INSERT INTO dbo.InventoryBalances (TenantId, OrganizationId, ProductVariantId, WarehouseId, BatchId)
                VALUES (@TenantId, @OrganizationId, @ProductVariantId, @WarehouseId, @BatchId);
                """;
            await conn.ExecuteAsync(new CommandDefinition(insertZero, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.ProductVariantId,
                request.WarehouseId,
                request.BatchId,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
            balance = await conn.QuerySingleAsync<BalanceRow>(new CommandDefinition(lockBalance, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.ProductVariantId,
                request.WarehouseId,
                request.BatchId,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
        }

        // 3. Insert the ledger row.
        const string insertLedger = """
            INSERT INTO dbo.InventoryTransactions (
                TenantId, OrganizationId, ProductVariantId, WarehouseId, WarehouseLocationId,
                BatchId, ProductSerialId, TransactionType, QuantityBucket, QtyChange, CostPerUnit,
                SourceDocumentType, SourceDocumentId, SourceLineId, IdempotencyKey, Reason, MetadataJson, CreatedBy)
            OUTPUT INSERTED.InventoryTransactionId
            VALUES (@TenantId, @OrganizationId, @ProductVariantId, @WarehouseId, NULL,
                @BatchId, @ProductSerialId, @TransactionType, @QuantityBucket, @QtyChange, @CostPerUnit,
                @SourceDocumentType, @SourceDocumentId, @SourceLineId, @IdempotencyKey, @Reason, @MetadataJson, @CreatedBy);
            """;
        long ledgerId;
        try
        {
            ledgerId = await conn.QuerySingleAsync<long>(new CommandDefinition(insertLedger, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.ProductVariantId,
                request.WarehouseId,
                request.BatchId,
                request.ProductSerialId,
                TransactionType = NormaliseTransactionType(request.TransactionType),
                QuantityBucket = NormaliseBucket(request.QuantityBucket),
                request.QtyChange,
                request.CostPerUnit,
                SourceDocumentType = NullIfBlank(request.SourceDocumentType),
                SourceDocumentId = request.SourceDocumentId,
                SourceLineId = request.SourceLineId,
                IdempotencyKey = NullIfBlank(request.IdempotencyKey),
                Reason = NullIfBlank(request.Reason),
                MetadataJson = NullIfBlank(request.MetadataJson),
                CreatedBy = NullIfBlank(actor),
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
        }
        catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number == 2601 || ex.Number == 2627)
        {
            // Unique-index collision on idempotency key — race with another writer; re-read & return.
            if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
            {
                const string existsSql = """
                    SELECT TOP 1 InventoryTransactionId FROM dbo.InventoryTransactions
                    WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND IdempotencyKey = @Key;
                    """;
                var prior = await conn.ExecuteScalarAsync<long?>(new CommandDefinition(existsSql, new
                {
                    TenantId = _wp.TenantId,
                    OrganizationId = _wp.OrganizationId,
                    Key = request.IdempotencyKey.Trim(),
                }, tx, cancellationToken: ct)).ConfigureAwait(false);
                if (prior.HasValue)
                    return prior.Value;
            }
            throw;
        }

        // 4. Apply quantity to the right bucket(s).
        var (onHand, reserved, damaged, incoming, inTransit) = ApplyQty(
            balance.OnHandQty, balance.ReservedQty, balance.DamagedQty, balance.IncomingQty, balance.InTransitQty,
            request.TransactionType, request.QuantityBucket, request.QtyChange);

        const string updateBalance = """
            UPDATE dbo.InventoryBalances
            SET OnHandQty = @OnHand,
                ReservedQty = @Reserved,
                DamagedQty = @Damaged,
                IncomingQty = @Incoming,
                InTransitQty = @InTransit,
                LastLedgerId = @LastLedgerId,
                UpdatedUtc = SYSUTCDATETIME()
            WHERE InventoryBalanceId = @InventoryBalanceId;
            """;
        await conn.ExecuteAsync(new CommandDefinition(updateBalance, new
        {
            OnHand = onHand,
            Reserved = reserved,
            Damaged = damaged,
            Incoming = incoming,
            InTransit = inTransit,
            LastLedgerId = ledgerId,
            balance.InventoryBalanceId,
        }, tx, cancellationToken: ct)).ConfigureAwait(false);

        return ledgerId;
    }

    public async Task<InventoryLedgerResult> LedgerAsync(InventoryLedgerQuery query, CancellationToken ct)
    {
        const string sql = """
            WITH src AS (
              SELECT t.InventoryTransactionId, t.ProductVariantId, COALESCE(v.DisplayName, p.Name) AS VariantDisplay, v.Sku,
                     t.WarehouseId, w.Name AS WarehouseName, t.BatchId, b.BatchNumber, t.ProductSerialId, s.SerialNumber,
                     t.TransactionType, t.QuantityBucket, t.QtyChange, t.CostPerUnit,
                     t.SourceDocumentType, t.SourceDocumentId, t.SourceLineId, t.ReversalOfTransactionId, t.Reason, t.CreatedBy, t.CreatedUtc
              FROM dbo.InventoryTransactions t
              INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = t.ProductVariantId
              INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
              INNER JOIN dbo.Warehouses w ON w.WarehouseId = t.WarehouseId
              LEFT JOIN dbo.Batches b ON b.BatchId = t.BatchId
              LEFT JOIN dbo.ProductSerials s ON s.ProductSerialId = t.ProductSerialId
              WHERE t.TenantId = @TenantId AND t.OrganizationId = @OrganizationId
                AND (@WarehouseId IS NULL OR t.WarehouseId = @WarehouseId)
                AND (@VariantId IS NULL OR t.ProductVariantId = @VariantId)
                AND (@ProductId IS NULL OR p.ProductId = @ProductId)
                AND (@Type IS NULL OR t.TransactionType = @Type)
                AND (@FromUtc IS NULL OR t.CreatedUtc >= @FromUtc)
                AND (@ToUtc IS NULL OR t.CreatedUtc < @ToUtc)
                AND (@Search IS NULL
                     OR p.Name LIKE @Like
                     OR v.Sku LIKE @Like
                     OR b.BatchNumber LIKE @Like
                     OR s.SerialNumber LIKE @Like)
            )
            SELECT * FROM src
            ORDER BY CreatedUtc DESC, InventoryTransactionId DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;

            SELECT COUNT(1) FROM (
              SELECT 1 AS one
              FROM dbo.InventoryTransactions t
              INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = t.ProductVariantId
              INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
              LEFT JOIN dbo.Batches b ON b.BatchId = t.BatchId
              LEFT JOIN dbo.ProductSerials s ON s.ProductSerialId = t.ProductSerialId
              WHERE t.TenantId = @TenantId AND t.OrganizationId = @OrganizationId
                AND (@WarehouseId IS NULL OR t.WarehouseId = @WarehouseId)
                AND (@VariantId IS NULL OR t.ProductVariantId = @VariantId)
                AND (@ProductId IS NULL OR p.ProductId = @ProductId)
                AND (@Type IS NULL OR t.TransactionType = @Type)
                AND (@FromUtc IS NULL OR t.CreatedUtc >= @FromUtc)
                AND (@ToUtc IS NULL OR t.CreatedUtc < @ToUtc)
                AND (@Search IS NULL
                     OR p.Name LIKE @Like
                     OR v.Sku LIKE @Like
                     OR b.BatchNumber LIKE @Like
                     OR s.SerialNumber LIKE @Like)
            ) src;
            """;
        var like = string.IsNullOrWhiteSpace(query.Search) ? null : $"%{query.Search.Trim()}%";
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        using var grid = await conn.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            WarehouseId = query.WarehouseId,
            VariantId = query.ProductVariantId,
            ProductId = query.ProductId,
            Type = NullIfBlank(query.TransactionType),
            FromUtc = query.FromUtc,
            ToUtc = query.ToUtc,
            Search = like,
            Like = like,
            Skip = Math.Max(0, query.Skip),
            Take = Math.Clamp(query.Take, 1, 200),
        }, cancellationToken: ct)).ConfigureAwait(false);

        var rowModels = (await grid.ReadAsync<LedgerTransactionRow>().ConfigureAwait(false)).AsList();
        var rows = rowModels.ConvertAll(ToTransactionDto);
        var total = await grid.ReadSingleAsync<int>().ConfigureAwait(false);
        return new InventoryLedgerResult(rows, total);
    }

    public async Task<InventoryTransactionDto?> GetTransactionAsync(long inventoryTransactionId, CancellationToken ct)
    {
        const string sql = """
            SELECT t.InventoryTransactionId, t.ProductVariantId, COALESCE(v.DisplayName, p.Name) AS VariantDisplay, v.Sku,
                   t.WarehouseId, w.Name AS WarehouseName, t.BatchId, b.BatchNumber, t.ProductSerialId, s.SerialNumber,
                   t.TransactionType, t.QuantityBucket, t.QtyChange, t.CostPerUnit,
                   t.SourceDocumentType, t.SourceDocumentId, t.SourceLineId, t.ReversalOfTransactionId, t.Reason, t.CreatedBy, t.CreatedUtc
            FROM dbo.InventoryTransactions t
            INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = t.ProductVariantId
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            INNER JOIN dbo.Warehouses w ON w.WarehouseId = t.WarehouseId
            LEFT JOIN dbo.Batches b ON b.BatchId = t.BatchId
            LEFT JOIN dbo.ProductSerials s ON s.ProductSerialId = t.ProductSerialId
            WHERE t.InventoryTransactionId = @Id
              AND t.TenantId = @TenantId AND t.OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var row = await conn.QuerySingleOrDefaultAsync<LedgerTransactionRow>(new CommandDefinition(sql, new
        {
            Id = inventoryTransactionId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return row is null ? null : ToTransactionDto(row);
    }

    public async Task<InventoryBalanceResult> BalancesAsync(InventoryBalanceQuery query, CancellationToken ct)
    {
        const string sql = """
            WITH src AS (
              SELECT v.ProductVariantId, COALESCE(v.DisplayName, p.Name) AS VariantDisplay, v.Sku,
                     p.ProductId, p.Name AS ProductName,
                     ib.WarehouseId, w.Name AS WarehouseName,
                     ib.BatchId, b.BatchNumber, b.ExpiryDate,
                     ib.OnHandQty, ib.ReservedQty, ib.DamagedQty, ib.IncomingQty, ib.InTransitQty,
                     (ib.OnHandQty - ib.ReservedQty - ib.DamagedQty) AS AvailableQty,
                     ib.AverageCost, ib.UpdatedUtc
              FROM dbo.InventoryBalances ib
              INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = ib.ProductVariantId
              INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
              INNER JOIN dbo.Warehouses w ON w.WarehouseId = ib.WarehouseId
              LEFT JOIN dbo.Batches b ON b.BatchId = ib.BatchId
              WHERE ib.TenantId = @TenantId AND ib.OrganizationId = @OrganizationId
                AND v.IsDeleted = 0
                AND (@WarehouseId IS NULL OR ib.WarehouseId = @WarehouseId)
                AND (@ProductId IS NULL OR p.ProductId = @ProductId)
                AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
                AND (@Search IS NULL
                     OR p.Name LIKE @Like
                     OR v.Sku LIKE @Like
                     OR b.BatchNumber LIKE @Like)
                AND (@LowOnly = 0 OR (ib.OnHandQty - ib.ReservedQty - ib.DamagedQty) <= COALESCE(p.LowStockThreshold, 0))
            )
            SELECT * FROM src
            ORDER BY UpdatedUtc DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;

            SELECT COUNT(1) FROM (
              SELECT 1 AS one
              FROM dbo.InventoryBalances ib
              INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = ib.ProductVariantId
              INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
              LEFT JOIN dbo.Batches b ON b.BatchId = ib.BatchId
              WHERE ib.TenantId = @TenantId AND ib.OrganizationId = @OrganizationId
                AND v.IsDeleted = 0
                AND (@WarehouseId IS NULL OR ib.WarehouseId = @WarehouseId)
                AND (@ProductId IS NULL OR p.ProductId = @ProductId)
                AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
                AND (@Search IS NULL OR p.Name LIKE @Like OR v.Sku LIKE @Like OR b.BatchNumber LIKE @Like)
                AND (@LowOnly = 0 OR (ib.OnHandQty - ib.ReservedQty - ib.DamagedQty) <= COALESCE(p.LowStockThreshold, 0))
            ) c;
            """;
        var like = string.IsNullOrWhiteSpace(query.Search) ? null : $"%{query.Search.Trim()}%";
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        using var grid = await conn.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            WarehouseId = query.WarehouseId,
            ProductId = query.ProductId,
            CategoryId = query.CategoryId,
            Search = like,
            Like = like,
            LowOnly = query.LowStockOnly ? 1 : 0,
            Skip = Math.Max(0, query.Skip),
            Take = Math.Clamp(query.Take, 1, 200),
        }, cancellationToken: ct)).ConfigureAwait(false);

        var rows = (await grid.ReadAsync<InventoryBalanceDto>().ConfigureAwait(false)).AsList();
        var total = await grid.ReadSingleAsync<int>().ConfigureAwait(false);
        return new InventoryBalanceResult(rows, total);
    }

    public async Task<InventoryDashboardDto> GetDashboardAsync(CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var p = new { T = _wp.TenantId, O = _wp.OrganizationId };

        // Head metrics use OBJECT_ID guards so a partially-applied UPIM migration still returns KPIs.
        const string headSql = """
            DECLARE @Today DATETIME2 = SYSUTCDATETIME();
            DECLARE @Soon DATETIME2 = DATEADD(DAY, 30, @Today);

            SELECT
              CASE WHEN OBJECT_ID(N'dbo.Warehouses', N'U') IS NOT NULL
                THEN (SELECT COUNT(1) FROM dbo.Warehouses WHERE TenantId=@T AND OrganizationId=@O AND IsDeleted=0 AND IsActive=1)
                ELSE 0 END AS TotalWarehouses,
              CASE WHEN OBJECT_ID(N'dbo.ProductVariants', N'U') IS NOT NULL
                THEN (SELECT COUNT(1) FROM dbo.ProductVariants WHERE TenantId=@T AND OrganizationId=@O AND IsDeleted=0 AND IsActive=1)
                ELSE 0 END AS TotalVariants,
              CASE WHEN OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
                THEN (SELECT COUNT(1) FROM dbo.Products WHERE TenantId=@T AND OrganizationId=@O AND IsActive=1)
                ELSE 0 END AS TotalProducts,
              CASE WHEN OBJECT_ID(N'dbo.InventoryBalances', N'U') IS NOT NULL
                THEN (SELECT ISNULL(SUM(OnHandQty), 0) FROM dbo.InventoryBalances WHERE TenantId=@T AND OrganizationId=@O)
                ELSE 0 END AS TotalOnHandQty,
              CASE WHEN OBJECT_ID(N'dbo.InventoryBalances', N'U') IS NOT NULL
                THEN (SELECT ISNULL(SUM(OnHandQty - ReservedQty - DamagedQty), 0) FROM dbo.InventoryBalances WHERE TenantId=@T AND OrganizationId=@O)
                ELSE 0 END AS TotalAvailableQty,
              CASE WHEN OBJECT_ID(N'dbo.InventoryBalances', N'U') IS NOT NULL
                THEN (SELECT ISNULL(SUM(ReservedQty), 0) FROM dbo.InventoryBalances WHERE TenantId=@T AND OrganizationId=@O)
                ELSE 0 END AS TotalReservedQty,
              CASE WHEN OBJECT_ID(N'dbo.InventoryBalances', N'U') IS NOT NULL
                   AND OBJECT_ID(N'dbo.ProductVariants', N'U') IS NOT NULL
                   AND OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
                THEN (SELECT ISNULL(SUM(ib.OnHandQty * ISNULL(ib.AverageCost, ISNULL(p.PurchasePrice, 0))), 0)
                        FROM dbo.InventoryBalances ib
                        INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = ib.ProductVariantId
                        INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
                        WHERE ib.TenantId=@T AND ib.OrganizationId=@O)
                ELSE 0 END AS InventoryValueAtCost,
              CASE WHEN OBJECT_ID(N'dbo.InventoryBalances', N'U') IS NOT NULL
                   AND OBJECT_ID(N'dbo.ProductVariants', N'U') IS NOT NULL
                   AND OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
                   AND COL_LENGTH(N'dbo.Products', N'LowStockThreshold') IS NOT NULL
                THEN (SELECT COUNT(DISTINCT ib.ProductVariantId)
                        FROM dbo.InventoryBalances ib
                        INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = ib.ProductVariantId
                        INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
                        WHERE ib.TenantId=@T AND ib.OrganizationId=@O
                          AND p.LowStockThreshold IS NOT NULL AND p.LowStockThreshold > 0
                          AND (ib.OnHandQty - ib.ReservedQty - ib.DamagedQty) > 0
                          AND (ib.OnHandQty - ib.ReservedQty - ib.DamagedQty) <= p.LowStockThreshold)
                ELSE 0 END AS LowStockSkuCount,
              CASE WHEN OBJECT_ID(N'dbo.ProductVariants', N'U') IS NOT NULL
                   AND OBJECT_ID(N'dbo.InventoryBalances', N'U') IS NOT NULL
                THEN (SELECT COUNT(DISTINCT v.ProductVariantId)
                        FROM dbo.ProductVariants v
                        WHERE v.TenantId=@T AND v.OrganizationId=@O AND v.IsDeleted=0 AND v.IsActive=1
                          AND ISNULL((SELECT SUM(OnHandQty - ReservedQty - DamagedQty)
                                        FROM dbo.InventoryBalances
                                        WHERE ProductVariantId = v.ProductVariantId
                                          AND TenantId = v.TenantId AND OrganizationId = v.OrganizationId), 0) <= 0)
                ELSE 0 END AS OutOfStockSkuCount,
              CASE WHEN OBJECT_ID(N'dbo.Batches', N'U') IS NOT NULL
                THEN (SELECT COUNT(1) FROM dbo.Batches
                        WHERE TenantId=@T AND OrganizationId=@O AND IsDeleted=0
                          AND ExpiryDate IS NOT NULL AND ExpiryDate >= @Today AND ExpiryDate <= @Soon)
                ELSE 0 END AS NearExpiryBatchCount,
              CASE WHEN OBJECT_ID(N'dbo.Batches', N'U') IS NOT NULL
                THEN (SELECT COUNT(1) FROM dbo.Batches
                        WHERE TenantId=@T AND OrganizationId=@O AND IsDeleted=0
                          AND ExpiryDate IS NOT NULL AND ExpiryDate < @Today)
                ELSE 0 END AS ExpiredBatchCount,
              CASE WHEN OBJECT_ID(N'dbo.InventoryReservations', N'U') IS NOT NULL
                THEN (SELECT COUNT(1) FROM dbo.InventoryReservations
                        WHERE TenantId=@T AND OrganizationId=@O AND Status = N'Active')
                ELSE 0 END AS OpenReservationCount,
              CASE WHEN OBJECT_ID(N'dbo.ProductSerials', N'U') IS NOT NULL
                THEN (SELECT COUNT(1) FROM dbo.ProductSerials
                        WHERE TenantId=@T AND OrganizationId=@O AND IsDeleted=0 AND Status = N'InStock')
                ELSE 0 END AS ActiveSerialsCount;
            """;

        const string tilesSql = """
            SELECT w.WarehouseId, w.Name,
                   ISNULL(SUM(ib.OnHandQty), 0) AS OnHandQty,
                   ISNULL(SUM(ib.OnHandQty - ib.ReservedQty - ib.DamagedQty), 0) AS AvailableQty,
                   COUNT(DISTINCT ib.ProductVariantId) AS SkuCount
            FROM dbo.Warehouses w
            LEFT JOIN dbo.InventoryBalances ib
              ON ib.WarehouseId = w.WarehouseId AND ib.TenantId = w.TenantId AND ib.OrganizationId = w.OrganizationId
            WHERE w.TenantId=@T AND w.OrganizationId=@O AND w.IsDeleted=0
            GROUP BY w.WarehouseId, w.Name, w.IsDefault
            ORDER BY w.IsDefault DESC, w.Name;
            """;

        const string recentSql = """
            SELECT TOP 8 t.InventoryTransactionId, t.CreatedUtc, t.TransactionType,
                   COALESCE(v.DisplayName, p.Name) AS VariantDisplay,
                   w.Name AS WarehouseName, t.QtyChange, t.Reason
            FROM dbo.InventoryTransactions t
            INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = t.ProductVariantId
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            INNER JOIN dbo.Warehouses w ON w.WarehouseId = t.WarehouseId
            WHERE t.TenantId=@T AND t.OrganizationId=@O
            ORDER BY t.InventoryTransactionId DESC;
            """;

        var head = await conn.QuerySingleAsync<DashboardHead>(
            new CommandDefinition(headSql, p, cancellationToken: ct)).ConfigureAwait(false);

        var tiles = new List<InventoryWarehouseTileDto>();
        if (await TableExistsAsync(conn, "dbo.Warehouses", ct).ConfigureAwait(false))
        {
            tiles = (await conn.QueryAsync<InventoryWarehouseTileDto>(
                new CommandDefinition(tilesSql, p, cancellationToken: ct)).ConfigureAwait(false)).AsList();
        }

        var recent = new List<InventoryRecentLedgerDto>();
        if (await TableExistsAsync(conn, "dbo.InventoryTransactions", ct).ConfigureAwait(false))
        {
            recent = (await conn.QueryAsync<InventoryRecentLedgerDto>(
                new CommandDefinition(recentSql, p, cancellationToken: ct)).ConfigureAwait(false)).AsList();
        }

        return new InventoryDashboardDto(
            head.TotalWarehouses, head.TotalVariants, head.TotalProducts,
            head.TotalOnHandQty, head.TotalAvailableQty, head.TotalReservedQty,
            head.InventoryValueAtCost,
            head.LowStockSkuCount, head.OutOfStockSkuCount,
            head.NearExpiryBatchCount, head.ExpiredBatchCount,
            head.OpenReservationCount, head.ActiveSerialsCount,
            tiles, recent);
    }

    private static async Task<bool> TableExistsAsync(DbConnection conn, string fullName, CancellationToken ct)
    {
        const string sql = "SELECT CASE WHEN OBJECT_ID(@Name, N'U') IS NOT NULL THEN 1 ELSE 0 END;";
        return await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, new { Name = fullName }, cancellationToken: ct)).ConfigureAwait(false) == 1;
    }

    public async Task<StockAdjustmentResultDto> SubmitAdjustmentAsync(SubmitStockAdjustmentRequest request, string? actor, CancellationToken ct)
    {
        if (request.Lines is null || request.Lines.Count == 0)
            throw new InvalidOperationException("At least one adjustment line is required.");
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new InvalidOperationException("Reason is required.");

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            // 1. Persist approval record (audit + workflow trail) regardless of approval path.
            var payload = JsonSerializer.Serialize(request.Lines);
            const string insertApproval = """
                INSERT INTO dbo.InventoryAdjustmentApprovals (
                    TenantId, OrganizationId, AdjustmentNumber, WarehouseId, Reason, Notes,
                    Status, PayloadJson, RequestedBy)
                OUTPUT INSERTED.InventoryAdjustmentApprovalId
                VALUES (@TenantId, @OrganizationId, NULL, @WarehouseId, @Reason, @Notes,
                    @Status, @PayloadJson, @RequestedBy);
                """;
            var approvalId = await conn.QuerySingleAsync<long>(new CommandDefinition(insertApproval, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.WarehouseId,
                Reason = request.Reason.Trim(),
                Notes = NullIfBlank(request.Notes),
                Status = request.RequireApproval ? "AwaitingApproval" : "Approved",
                PayloadJson = payload,
                RequestedBy = NullIfBlank(actor),
            }, tx, cancellationToken: ct)).ConfigureAwait(false);

            await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE dbo.InventoryAdjustmentApprovals
                SET AdjustmentNumber = CONCAT(N'ADJ-', FORMAT(@Id, N'D6'))
                WHERE InventoryAdjustmentApprovalId = @Id;
                """, new { Id = approvalId }, tx, cancellationToken: ct)).ConfigureAwait(false);

            if (request.RequireApproval)
            {
                await tx.CommitAsync(ct).ConfigureAwait(false);
                return new StockAdjustmentResultDto(approvalId, $"ADJ-{approvalId:D6}", "AwaitingApproval", 0);
            }

            // 2. Approval auto-granted — post each line.
            var posted = await PostAdjustmentLinesAsync(conn, tx, approvalId, request, actor, ct).ConfigureAwait(false);

            await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE dbo.InventoryAdjustmentApprovals
                SET ApprovedBy = @Actor, ApprovedUtc = SYSUTCDATETIME(), Status = N'Posted'
                WHERE InventoryAdjustmentApprovalId = @Id;
                """, new { Id = approvalId, Actor = NullIfBlank(actor) }, tx, cancellationToken: ct)).ConfigureAwait(false);

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return new StockAdjustmentResultDto(approvalId, $"ADJ-{approvalId:D6}", "Posted", posted);
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<bool> ApproveAdjustmentAsync(long adjustmentApprovalId, string? actor, CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            const string load = """
                SELECT InventoryAdjustmentApprovalId, WarehouseId, Reason, Notes, Status, PayloadJson
                FROM dbo.InventoryAdjustmentApprovals
                WHERE InventoryAdjustmentApprovalId = @Id AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """;
            var head = await conn.QuerySingleOrDefaultAsync<ApprovalRow>(new CommandDefinition(load, new
            {
                Id = adjustmentApprovalId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (head is null) return false;
            if (!string.Equals(head.Status, "AwaitingApproval", StringComparison.OrdinalIgnoreCase))
                return false;

            var lines = JsonSerializer.Deserialize<List<StockAdjustmentLineRequest>>(head.PayloadJson ?? "[]") ?? new();
            var req = new SubmitStockAdjustmentRequest(head.WarehouseId, head.Reason ?? "", head.Notes, false, lines);
            await PostAdjustmentLinesAsync(conn, tx, adjustmentApprovalId, req, actor, ct).ConfigureAwait(false);

            await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE dbo.InventoryAdjustmentApprovals
                SET ApprovedBy = @Actor, ApprovedUtc = SYSUTCDATETIME(), Status = N'Posted'
                WHERE InventoryAdjustmentApprovalId = @Id;
                """, new { Id = adjustmentApprovalId, Actor = NullIfBlank(actor) }, tx, cancellationToken: ct)).ConfigureAwait(false);

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return true;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    private async Task<int> PostAdjustmentLinesAsync(DbConnection conn, DbTransaction tx, long approvalId, SubmitStockAdjustmentRequest request, string? actor, CancellationToken ct)
    {
        var posted = 0;
        foreach (var line in request.Lines)
        {
            var delta = line.ActualQty - line.SystemQty;
            if (delta == 0) continue;
            var type = delta > 0 ? InventoryTransactionTypes.AdjustmentPositive : InventoryTransactionTypes.AdjustmentNegative;
            var requestRow = new PostInventoryTransactionRequest(
                line.ProductVariantId,
                request.WarehouseId,
                line.BatchId,
                line.ProductSerialId,
                type,
                InventoryQuantityBuckets.Available,
                delta,
                CostPerUnit: null,
                SourceDocumentType: "InventoryAdjustment",
                SourceDocumentId: approvalId,
                SourceLineId: posted + 1,
                IdempotencyKey: $"ADJ:{approvalId}:V{line.ProductVariantId}:L{posted + 1}",
                Reason: string.IsNullOrWhiteSpace(line.Reason) ? request.Reason : line.Reason,
                MetadataJson: null);
            await PostTransactionInternalAsync(conn, tx, requestRow, actor, ct).ConfigureAwait(false);
            posted++;
        }
        return posted;
    }

    /* --------------------------- helpers --------------------------- */

    /// <summary>Dapper row shape for ledger queries (class avoids record/ctor mapping edge cases).</summary>
    private sealed class LedgerTransactionRow
    {
        public long InventoryTransactionId { get; init; }
        public long ProductVariantId { get; init; }
        public string VariantDisplay { get; init; } = "";
        public string? Sku { get; init; }
        public long WarehouseId { get; init; }
        public string WarehouseName { get; init; } = "";
        public long? BatchId { get; init; }
        public string? BatchNumber { get; init; }
        public long? ProductSerialId { get; init; }
        public string? SerialNumber { get; init; }
        public string TransactionType { get; init; } = "";
        public string QuantityBucket { get; init; } = "";
        public decimal QtyChange { get; init; }
        public decimal? CostPerUnit { get; init; }
        public string? SourceDocumentType { get; init; }
        public long? SourceDocumentId { get; init; }
        public long? SourceLineId { get; init; }
        public long? ReversalOfTransactionId { get; init; }
        public string? Reason { get; init; }
        public string? CreatedBy { get; init; }
        public DateTime CreatedUtc { get; init; }
    }

    private static InventoryTransactionDto ToTransactionDto(LedgerTransactionRow r) =>
        new(
            r.InventoryTransactionId,
            r.ProductVariantId,
            r.VariantDisplay,
            r.Sku,
            r.WarehouseId,
            r.WarehouseName,
            r.BatchId,
            r.BatchNumber,
            r.ProductSerialId,
            r.SerialNumber,
            r.TransactionType,
            r.QuantityBucket,
            r.QtyChange,
            r.CostPerUnit,
            r.SourceDocumentType,
            r.SourceDocumentId,
            r.SourceLineId,
            r.ReversalOfTransactionId,
            r.Reason,
            r.CreatedBy,
            r.CreatedUtc);

    private sealed record BalanceRow(long InventoryBalanceId, decimal OnHandQty, decimal ReservedQty, decimal DamagedQty, decimal IncomingQty, decimal InTransitQty);

    private sealed record DashboardHead(
        int TotalWarehouses, int TotalVariants, int TotalProducts,
        decimal TotalOnHandQty, decimal TotalAvailableQty, decimal TotalReservedQty,
        decimal InventoryValueAtCost,
        int LowStockSkuCount, int OutOfStockSkuCount,
        int NearExpiryBatchCount, int ExpiredBatchCount,
        int OpenReservationCount, int ActiveSerialsCount);

    private sealed record ApprovalRow(long InventoryAdjustmentApprovalId, long WarehouseId, string? Reason, string? Notes, string Status, string? PayloadJson);

    private static (decimal onHand, decimal reserved, decimal damaged, decimal incoming, decimal inTransit) ApplyQty(
        decimal onHand, decimal reserved, decimal damaged, decimal incoming, decimal inTransit,
        string type, string bucket, decimal qty)
    {
        // Bucket-based update: keep buckets independent, then derive available = OnHand - Reserved - Damaged.
        switch (NormaliseBucket(bucket))
        {
            case "Reserved":
                reserved = ClampNonNegative(reserved + qty);
                break;
            case "Damaged":
                damaged = ClampNonNegative(damaged + qty);
                break;
            case "Incoming":
                incoming = ClampNonNegative(incoming + qty);
                break;
            case "InTransit":
                inTransit = ClampNonNegative(inTransit + qty);
                break;
            default:
                // Available bucket — most transaction types live here.
                onHand += qty;
                break;
        }

        // RESERVE/RELEASE/COMMIT semantics aren't bucket-only: they also touch OnHand for commit.
        switch ((type ?? string.Empty).ToUpperInvariant())
        {
            case "COMMIT_RESERVATION":
                onHand -= Math.Abs(qty);
                reserved = ClampNonNegative(reserved - Math.Abs(qty));
                break;
            case "TRANSFER_OUT":
                inTransit = ClampNonNegative(inTransit + Math.Abs(qty));
                break;
            case "TRANSFER_IN":
                inTransit = ClampNonNegative(inTransit - Math.Abs(qty));
                break;
        }

        return (onHand, ClampNonNegative(reserved), ClampNonNegative(damaged), ClampNonNegative(incoming), ClampNonNegative(inTransit));
    }

    private static decimal ClampNonNegative(decimal x) => x < 0 ? 0 : x;

    private static void ValidateRequest(PostInventoryTransactionRequest r)
    {
        if (r.ProductVariantId <= 0)
            throw new InvalidOperationException("ProductVariantId is required.");
        if (r.WarehouseId <= 0)
            throw new InvalidOperationException("WarehouseId is required.");
        if (string.IsNullOrWhiteSpace(r.TransactionType))
            throw new InvalidOperationException("TransactionType is required.");
        if (r.QtyChange == 0)
            throw new InvalidOperationException("QtyChange cannot be zero.");
    }

    private static string NormaliseTransactionType(string s) => string.IsNullOrWhiteSpace(s) ? "UNKNOWN" : s.Trim().ToUpperInvariant();
    private static string NormaliseBucket(string? s)
    {
        if (string.IsNullOrWhiteSpace(s))
            return "Available";
        return s.Trim() switch
        {
            "Reserved" or "reserved" or "RESERVED" => "Reserved",
            "Damaged" or "damaged" or "DAMAGED" => "Damaged",
            "Incoming" or "incoming" or "INCOMING" => "Incoming",
            "InTransit" or "intransit" or "INTRANSIT" or "In_Transit" => "InTransit",
            _ => "Available",
        };
    }
    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
