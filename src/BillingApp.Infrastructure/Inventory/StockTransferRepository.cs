using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Inventory;
using Dapper;

namespace BillingApp.Infrastructure.Inventory;

/// <summary>
/// Stock transfers are modelled as paired ledger postings (TRANSFER_OUT at source,
/// TRANSFER_IN at destination) sharing a transfer document id. We don't persist a
/// separate StockTransfer table at this stage — the ledger holds the truth and
/// SourceDocumentType='StockTransfer' is the join key.
/// </summary>
public sealed class StockTransferRepository : IStockTransferRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;
    private readonly IInventoryRepository _inv;

    public StockTransferRepository(IDbConnectionFactory db, IWorkplaceContext wp, IInventoryRepository inv)
    {
        _db = db;
        _wp = wp;
        _inv = inv;
    }

    public async Task<long> CreateAsync(CreateStockTransferRequest request, string? actor, CancellationToken ct)
    {
        if (request.FromWarehouseId == request.ToWarehouseId)
            throw new InvalidOperationException("Source and destination warehouses must differ.");
        if (request.Lines is null || request.Lines.Count == 0)
            throw new InvalidOperationException("At least one line is required.");

        // Compose a synthetic transfer id from time-based bigint so both sides share it.
        var transferId = DateTime.UtcNow.Ticks;

        var seq = 0;
        foreach (var line in request.Lines)
        {
            seq++;
            if (line.Quantity <= 0)
                throw new InvalidOperationException("Transfer line quantity must be positive.");

            await _inv.PostTransactionAsync(new PostInventoryTransactionRequest(
                line.ProductVariantId, request.FromWarehouseId, line.BatchId, null,
                InventoryTransactionTypes.TransferOut, InventoryQuantityBuckets.Available,
                QtyChange: -line.Quantity,
                CostPerUnit: line.UnitCost,
                SourceDocumentType: "StockTransfer",
                SourceDocumentId: transferId,
                SourceLineId: seq,
                IdempotencyKey: $"XFER:{transferId}:OUT:L{seq}",
                Reason: NullIfBlank(request.Notes) ?? $"Transfer to warehouse #{request.ToWarehouseId}",
                MetadataJson: null), ct).ConfigureAwait(false);

            await _inv.PostTransactionAsync(new PostInventoryTransactionRequest(
                line.ProductVariantId, request.ToWarehouseId, line.BatchId, null,
                InventoryTransactionTypes.TransferIn, InventoryQuantityBuckets.Available,
                QtyChange: line.Quantity,
                CostPerUnit: line.UnitCost,
                SourceDocumentType: "StockTransfer",
                SourceDocumentId: transferId,
                SourceLineId: seq,
                IdempotencyKey: $"XFER:{transferId}:IN:L{seq}",
                Reason: NullIfBlank(request.Notes) ?? $"Transfer from warehouse #{request.FromWarehouseId}",
                MetadataJson: null), ct).ConfigureAwait(false);
        }

        return transferId;
    }

    public async Task<StockTransferDto?> GetAsync(long stockTransferId, CancellationToken ct)
    {
        const string sql = """
            DECLARE @TFromId BIGINT, @TToId BIGINT;
            SELECT TOP 1 @TFromId = t.WarehouseId
            FROM dbo.InventoryTransactions t
            WHERE t.TenantId = @TenantId AND t.OrganizationId = @OrganizationId
              AND t.SourceDocumentType = N'StockTransfer'
              AND t.SourceDocumentId = @Id
              AND t.TransactionType = N'TRANSFER_OUT'
            ORDER BY t.InventoryTransactionId;
            SELECT TOP 1 @TToId = t.WarehouseId
            FROM dbo.InventoryTransactions t
            WHERE t.TenantId = @TenantId AND t.OrganizationId = @OrganizationId
              AND t.SourceDocumentType = N'StockTransfer'
              AND t.SourceDocumentId = @Id
              AND t.TransactionType = N'TRANSFER_IN'
            ORDER BY t.InventoryTransactionId;

            SELECT @Id AS StockTransferId,
                   CONCAT(N'TRF-', FORMAT(@Id, N'D6')) AS TransferNumber,
                   @TFromId AS FromWarehouseId,
                   (SELECT Name FROM dbo.Warehouses WHERE WarehouseId = @TFromId) AS FromWarehouseName,
                   @TToId AS ToWarehouseId,
                   (SELECT Name FROM dbo.Warehouses WHERE WarehouseId = @TToId) AS ToWarehouseName,
                   (SELECT MIN(CreatedUtc) FROM dbo.InventoryTransactions
                       WHERE SourceDocumentType = N'StockTransfer' AND SourceDocumentId = @Id) AS TransferDateUtc,
                   N'Posted' AS Status,
                   (SELECT COUNT(DISTINCT SourceLineId) FROM dbo.InventoryTransactions
                       WHERE SourceDocumentType = N'StockTransfer' AND SourceDocumentId = @Id) AS LineCount,
                   (SELECT ISNULL(SUM(ABS(QtyChange)), 0)/2.0 FROM dbo.InventoryTransactions
                       WHERE SourceDocumentType = N'StockTransfer' AND SourceDocumentId = @Id
                         AND TransactionType = N'TRANSFER_OUT') AS TotalQuantity,
                   (SELECT ISNULL(SUM(ABS(QtyChange) * COALESCE(CostPerUnit, 0)), 0) FROM dbo.InventoryTransactions
                       WHERE SourceDocumentType = N'StockTransfer' AND SourceDocumentId = @Id
                         AND TransactionType = N'TRANSFER_OUT') AS TotalValue,
                   (SELECT TOP 1 Reason FROM dbo.InventoryTransactions
                       WHERE SourceDocumentType = N'StockTransfer' AND SourceDocumentId = @Id
                         AND TransactionType = N'TRANSFER_OUT') AS Notes,
                   (SELECT TOP 1 CreatedBy FROM dbo.InventoryTransactions
                       WHERE SourceDocumentType = N'StockTransfer' AND SourceDocumentId = @Id
                       ORDER BY InventoryTransactionId) AS CreatedBy,
                   (SELECT MIN(CreatedUtc) FROM dbo.InventoryTransactions
                       WHERE SourceDocumentType = N'StockTransfer' AND SourceDocumentId = @Id) AS CreatedUtc;

            SELECT t.ProductVariantId, COALESCE(v.DisplayName, p.Name) AS VariantDisplay, v.Sku,
                   t.BatchId, b.BatchNumber, ABS(t.QtyChange) AS Quantity, t.CostPerUnit AS UnitCost,
                   ABS(t.QtyChange) * t.CostPerUnit AS LineValue
            FROM dbo.InventoryTransactions t
            INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = t.ProductVariantId
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            LEFT JOIN dbo.Batches b ON b.BatchId = t.BatchId
            WHERE t.TenantId = @TenantId AND t.OrganizationId = @OrganizationId
              AND t.SourceDocumentType = N'StockTransfer' AND t.SourceDocumentId = @Id
              AND t.TransactionType = N'TRANSFER_OUT'
            ORDER BY t.SourceLineId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        using var grid = await conn.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            Id = stockTransferId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        var head = await grid.ReadSingleOrDefaultAsync<HeadRow>().ConfigureAwait(false);
        if (head is null || head.FromWarehouseId == 0)
            return null;
        var lines = (await grid.ReadAsync<StockTransferLineDto>().ConfigureAwait(false)).AsList();
        return new StockTransferDto(
            head.StockTransferId, head.TransferNumber, head.FromWarehouseId, head.FromWarehouseName,
            head.ToWarehouseId, head.ToWarehouseName, head.TransferDateUtc, head.Status,
            head.LineCount, head.TotalQuantity, head.TotalValue, head.Notes, head.CreatedBy,
            head.CreatedUtc, lines);
    }

    public async Task<IReadOnlyList<StockTransferSummaryDto>> ListAsync(string? status, int skip, int take, CancellationToken ct)
    {
        const string sql = """
            ;WITH src AS (
              SELECT t.SourceDocumentId AS StockTransferId,
                     MAX(CASE WHEN t.TransactionType = N'TRANSFER_OUT' THEN t.WarehouseId END) AS FromWarehouseId,
                     MAX(CASE WHEN t.TransactionType = N'TRANSFER_IN' THEN t.WarehouseId END) AS ToWarehouseId,
                     MIN(t.CreatedUtc) AS TransferDateUtc,
                     COUNT(DISTINCT t.SourceLineId) AS LineCount,
                     SUM(CASE WHEN t.TransactionType = N'TRANSFER_OUT' THEN ABS(t.QtyChange) ELSE 0 END) AS TotalQuantity,
                     SUM(CASE WHEN t.TransactionType = N'TRANSFER_OUT' THEN ABS(t.QtyChange) * COALESCE(t.CostPerUnit, 0) ELSE 0 END) AS TotalValue
              FROM dbo.InventoryTransactions t
              WHERE t.TenantId = @TenantId AND t.OrganizationId = @OrganizationId
                AND t.SourceDocumentType = N'StockTransfer'
              GROUP BY t.SourceDocumentId
            )
            SELECT TOP (@Take) s.StockTransferId,
                   CONCAT(N'TRF-', FORMAT(s.StockTransferId, N'D6')) AS TransferNumber,
                   s.FromWarehouseId, wFrom.Name AS FromWarehouseName,
                   s.ToWarehouseId, wTo.Name AS ToWarehouseName,
                   s.TransferDateUtc, N'Posted' AS Status,
                   s.LineCount, s.TotalQuantity, s.TotalValue
            FROM src s
            LEFT JOIN dbo.Warehouses wFrom ON wFrom.WarehouseId = s.FromWarehouseId
            LEFT JOIN dbo.Warehouses wTo ON wTo.WarehouseId = s.ToWarehouseId
            ORDER BY s.TransferDateUtc DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<StockTransferSummaryDto>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            Skip = Math.Max(0, skip),
            Take = Math.Clamp(take, 1, 200),
            Status = status,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    private sealed record HeadRow(
        long StockTransferId, string TransferNumber,
        long FromWarehouseId, string FromWarehouseName,
        long ToWarehouseId, string ToWarehouseName,
        DateTime TransferDateUtc, string Status,
        int LineCount, decimal TotalQuantity, decimal? TotalValue, string? Notes, string? CreatedBy, DateTime CreatedUtc);

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
