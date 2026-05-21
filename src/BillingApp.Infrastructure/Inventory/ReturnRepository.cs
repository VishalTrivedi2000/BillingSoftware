using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Inventory;
using Dapper;

namespace BillingApp.Infrastructure.Inventory;

public sealed class ReturnRepository : IReturnRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;
    private readonly IInventoryRepository _inv;
    private readonly IWarehouseRepository _warehouses;

    public ReturnRepository(IDbConnectionFactory db, IWorkplaceContext wp, IInventoryRepository inv, IWarehouseRepository warehouses)
    {
        _db = db;
        _wp = wp;
        _inv = inv;
        _warehouses = warehouses;
    }

    public async Task<long> CreateAsync(CreateReturnRequest request, string? actor, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ReturnType))
            throw new InvalidOperationException("ReturnType is required.");
        if (request.Lines is null || request.Lines.Count == 0)
            throw new InvalidOperationException("At least one return line is required.");

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            const string insertHead = """
                INSERT INTO dbo.ReturnAuthorizations (
                    TenantId, OrganizationId, ReturnNumber, ReturnType, SourceDocumentType, SourceDocumentId,
                    PartyId, WarehouseId, Reason, Status, TotalRefundAmount, Notes, RequestedUtc, CreatedBy)
                OUTPUT INSERTED.ReturnAuthorizationId
                VALUES (@TenantId, @OrganizationId, NULL, @ReturnType, @SourceDocumentType, @SourceDocumentId,
                    @PartyId, @WarehouseId, @Reason, N'Requested', @TotalRefundAmount, @Notes, SYSUTCDATETIME(), @CreatedBy);
                """;

            var totalRefund = request.Lines
                .Select(l => l.LineRefundAmountOrComputed())
                .Where(v => v.HasValue)
                .Sum(v => v ?? 0m);

            var id = await conn.QuerySingleAsync<long>(new CommandDefinition(insertHead, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                ReturnType = request.ReturnType.Trim(),
                SourceDocumentType = NullIfBlank(request.SourceDocumentType),
                SourceDocumentId = request.SourceDocumentId,
                PartyId = request.PartyId,
                WarehouseId = request.WarehouseId,
                Reason = NullIfBlank(request.Reason),
                TotalRefundAmount = totalRefund,
                Notes = NullIfBlank(request.Notes),
                CreatedBy = NullIfBlank(actor),
            }, tx, cancellationToken: ct)).ConfigureAwait(false);

            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE dbo.ReturnAuthorizations SET ReturnNumber = CONCAT(N'RTN-', FORMAT(@Id, N'D6')) WHERE ReturnAuthorizationId = @Id;",
                new { Id = id }, tx, cancellationToken: ct)).ConfigureAwait(false);

            const string insertLine = """
                INSERT INTO dbo.ReturnLines (
                    ReturnAuthorizationId, ProductVariantId, ProductSerialId, BatchId,
                    Quantity, UnitRefundAmount, LineRefundAmount, Reason, Disposition, Notes)
                VALUES (@ReturnId, @ProductVariantId, @ProductSerialId, @BatchId,
                    @Quantity, @UnitRefundAmount, @LineRefundAmount, @Reason, @Disposition, @Notes);
                """;
            foreach (var line in request.Lines)
            {
                if (line.Quantity <= 0)
                    throw new InvalidOperationException("Return line quantity must be positive.");
                await conn.ExecuteAsync(new CommandDefinition(insertLine, new
                {
                    ReturnId = id,
                    line.ProductVariantId,
                    line.ProductSerialId,
                    line.BatchId,
                    line.Quantity,
                    line.UnitRefundAmount,
                    LineRefundAmount = line.LineRefundAmountOrComputed(),
                    Reason = NullIfBlank(line.Reason),
                    Disposition = NullIfBlank(line.Disposition),
                    Notes = NullIfBlank(line.Notes),
                }, tx, cancellationToken: ct)).ConfigureAwait(false);
            }

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return id;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<ReturnDto?> GetAsync(long returnAuthorizationId, CancellationToken ct)
    {
        const string sql = """
            SELECT r.ReturnAuthorizationId, r.ReturnNumber, r.ReturnType, r.SourceDocumentType, r.SourceDocumentId,
                   r.PartyId, party.DisplayName AS PartyName, r.WarehouseId, w.Name AS WarehouseName,
                   r.Reason, r.Status, r.TotalRefundAmount, r.Notes,
                   r.RequestedUtc, r.ApprovedUtc, r.ReceivedUtc, r.InspectedUtc, r.CompletedUtc, r.CreatedBy
            FROM dbo.ReturnAuthorizations r
            LEFT JOIN dbo.Parties party ON party.PartyId = r.PartyId
            LEFT JOIN dbo.Warehouses w ON w.WarehouseId = r.WarehouseId
            WHERE r.ReturnAuthorizationId = @Id AND r.TenantId = @TenantId AND r.OrganizationId = @OrganizationId;

            SELECT rl.ReturnLineId, rl.ProductVariantId,
                   COALESCE(v.DisplayName, p.Name) AS VariantDisplay, v.Sku,
                   rl.ProductSerialId, s.SerialNumber, rl.BatchId, b.BatchNumber,
                   rl.Quantity, rl.UnitRefundAmount, rl.LineRefundAmount,
                   rl.Reason, rl.Disposition, rl.InspectionResult, rl.Notes
            FROM dbo.ReturnLines rl
            LEFT JOIN dbo.ProductVariants v ON v.ProductVariantId = rl.ProductVariantId
            LEFT JOIN dbo.Products p ON p.ProductId = v.ProductId
            LEFT JOIN dbo.ProductSerials s ON s.ProductSerialId = rl.ProductSerialId
            LEFT JOIN dbo.Batches b ON b.BatchId = rl.BatchId
            WHERE rl.ReturnAuthorizationId = @Id
            ORDER BY rl.ReturnLineId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        using var grid = await conn.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            Id = returnAuthorizationId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        var head = await grid.ReadSingleOrDefaultAsync<HeadRow>().ConfigureAwait(false);
        if (head is null)
            return null;
        var lines = (await grid.ReadAsync<ReturnLineDto>().ConfigureAwait(false)).AsList();
        return new ReturnDto(
            head.ReturnAuthorizationId, head.ReturnNumber, head.ReturnType, head.SourceDocumentType, head.SourceDocumentId,
            head.PartyId, head.PartyName, head.WarehouseId, head.WarehouseName,
            head.Reason, head.Status, head.TotalRefundAmount, head.Notes,
            head.RequestedUtc, head.ApprovedUtc, head.ReceivedUtc, head.InspectedUtc, head.CompletedUtc, head.CreatedBy,
            lines);
    }

    public async Task<ReturnBrowseResult> BrowseAsync(ReturnBrowseQuery query, CancellationToken ct)
    {
        const string sql = """
            WITH src AS (
              SELECT r.ReturnAuthorizationId, r.ReturnNumber, r.ReturnType, r.Status,
                     party.DisplayName AS PartyName, w.Name AS WarehouseName, r.RequestedUtc, r.TotalRefundAmount,
                     (SELECT COUNT(1) FROM dbo.ReturnLines rl WHERE rl.ReturnAuthorizationId = r.ReturnAuthorizationId) AS LineCount,
                     (SELECT ISNULL(SUM(rl.Quantity), 0) FROM dbo.ReturnLines rl WHERE rl.ReturnAuthorizationId = r.ReturnAuthorizationId) AS TotalQuantity
              FROM dbo.ReturnAuthorizations r
              LEFT JOIN dbo.Parties party ON party.PartyId = r.PartyId
              LEFT JOIN dbo.Warehouses w ON w.WarehouseId = r.WarehouseId
              WHERE r.TenantId = @TenantId AND r.OrganizationId = @OrganizationId
                AND (@ReturnType IS NULL OR r.ReturnType = @ReturnType)
                AND (@Status IS NULL OR r.Status = @Status)
                AND (@FromUtc IS NULL OR r.RequestedUtc >= @FromUtc)
                AND (@ToUtc IS NULL OR r.RequestedUtc < @ToUtc)
                AND (@Search IS NULL OR r.ReturnNumber LIKE @Like OR party.DisplayName LIKE @Like)
            )
            SELECT * FROM src
            ORDER BY RequestedUtc DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;

            SELECT COUNT(1) FROM dbo.ReturnAuthorizations r
            WHERE r.TenantId = @TenantId AND r.OrganizationId = @OrganizationId
              AND (@ReturnType IS NULL OR r.ReturnType = @ReturnType)
              AND (@Status IS NULL OR r.Status = @Status)
              AND (@FromUtc IS NULL OR r.RequestedUtc >= @FromUtc)
              AND (@ToUtc IS NULL OR r.RequestedUtc < @ToUtc);
            """;
        var like = string.IsNullOrWhiteSpace(query.Search) ? null : $"%{query.Search.Trim()}%";
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        using var grid = await conn.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            ReturnType = NullIfBlank(query.ReturnType),
            Status = NullIfBlank(query.Status),
            FromUtc = query.FromUtc,
            ToUtc = query.ToUtc,
            Search = like,
            Like = like,
            Skip = Math.Max(0, query.Skip),
            Take = Math.Clamp(query.Take, 1, 200),
        }, cancellationToken: ct)).ConfigureAwait(false);
        var rows = (await grid.ReadAsync<ReturnSummaryDto>().ConfigureAwait(false)).AsList();
        var total = await grid.ReadSingleAsync<int>().ConfigureAwait(false);
        return new ReturnBrowseResult(rows, total);
    }

    public async Task<bool> ApproveAsync(long returnAuthorizationId, string? actor, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.ReturnAuthorizations
            SET Status = N'Approved', ApprovedUtc = SYSUTCDATETIME()
            WHERE ReturnAuthorizationId = @Id AND TenantId = @TenantId AND OrganizationId = @OrganizationId
              AND Status = N'Requested';
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = returnAuthorizationId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return n == 1;
    }

    public async Task<bool> ReceiveAsync(long returnAuthorizationId, string? actor, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.ReturnAuthorizations
            SET Status = N'Received', ReceivedUtc = SYSUTCDATETIME()
            WHERE ReturnAuthorizationId = @Id AND TenantId = @TenantId AND OrganizationId = @OrganizationId
              AND Status IN (N'Requested', N'Approved');
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = returnAuthorizationId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return n == 1;
    }

    public async Task<bool> InspectAndCompleteAsync(long returnAuthorizationId, string? actor, CancellationToken ct)
    {
        var head = await GetAsync(returnAuthorizationId, ct).ConfigureAwait(false);
        if (head is null)
            return false;
        if (!string.Equals(head.Status, "Received", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(head.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            return false;

        long warehouseId = head.WarehouseId ?? await _warehouses.EnsureDefaultWarehouseIdAsync(ct).ConfigureAwait(false) ?? 0;
        if (warehouseId == 0)
            throw new InvalidOperationException("No warehouse available to receive returned stock.");

        // Post stock movement for every sellable line.
        var seq = 0;
        foreach (var line in head.Lines)
        {
            seq++;
            if (line.ProductVariantId is null)
                continue;

            var disposition = (line.Disposition ?? "Sellable").Trim();
            var bucket = disposition.Equals("Damaged", StringComparison.OrdinalIgnoreCase)
                ? InventoryQuantityBuckets.Damaged
                : InventoryQuantityBuckets.Available;
            var type = head.ReturnType.Equals("CustomerReturn", StringComparison.OrdinalIgnoreCase)
                ? InventoryTransactionTypes.SaleReturn
                : head.ReturnType.Equals("Exchange", StringComparison.OrdinalIgnoreCase)
                    ? InventoryTransactionTypes.SaleReturn
                    : head.ReturnType.Equals("SupplierReturn", StringComparison.OrdinalIgnoreCase)
                        ? InventoryTransactionTypes.PurchaseReturn
                        : InventoryTransactionTypes.SaleReturn;
            var qtyChange = type == InventoryTransactionTypes.PurchaseReturn ? -line.Quantity : line.Quantity;
            await _inv.PostTransactionAsync(new PostInventoryTransactionRequest(
                line.ProductVariantId.Value, warehouseId, line.BatchId, line.ProductSerialId,
                type, bucket, qtyChange,
                CostPerUnit: null,
                SourceDocumentType: "ReturnAuthorization",
                SourceDocumentId: returnAuthorizationId,
                SourceLineId: line.ReturnLineId,
                IdempotencyKey: $"RTN:{returnAuthorizationId}:L{line.ReturnLineId}",
                Reason: line.Reason ?? head.Reason,
                MetadataJson: null), ct).ConfigureAwait(false);
        }

        const string finalise = """
            UPDATE dbo.ReturnAuthorizations
            SET Status = N'Completed', InspectedUtc = COALESCE(InspectedUtc, SYSUTCDATETIME()),
                CompletedUtc = SYSUTCDATETIME()
            WHERE ReturnAuthorizationId = @Id AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(new CommandDefinition(finalise, new
        {
            Id = returnAuthorizationId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        return n == 1;
    }

    private sealed record HeadRow(
        long ReturnAuthorizationId, string? ReturnNumber, string ReturnType,
        string? SourceDocumentType, long? SourceDocumentId,
        long? PartyId, string? PartyName, long? WarehouseId, string? WarehouseName,
        string? Reason, string Status, decimal? TotalRefundAmount, string? Notes,
        DateTime RequestedUtc, DateTime? ApprovedUtc, DateTime? ReceivedUtc, DateTime? InspectedUtc, DateTime? CompletedUtc, string? CreatedBy);

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

internal static class ReturnLineRequestExtensions
{
    public static decimal? LineRefundAmountOrComputed(this ReturnLineRequest line)
    {
        if (line.UnitRefundAmount.HasValue)
            return line.UnitRefundAmount.Value * line.Quantity;
        return null;
    }
}
