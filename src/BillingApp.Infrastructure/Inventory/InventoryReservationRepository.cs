using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Inventory;
using Dapper;

namespace BillingApp.Infrastructure.Inventory;

public sealed class InventoryReservationRepository : IInventoryReservationRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;
    private readonly IInventoryRepository _inv;

    public InventoryReservationRepository(IDbConnectionFactory db, IWorkplaceContext wp, IInventoryRepository inv)
    {
        _db = db;
        _wp = wp;
        _inv = inv;
    }

    public async Task<long> CreateAsync(CreateReservationRequest request, string? actor, CancellationToken ct)
    {
        if (request.Lines is null || request.Lines.Count == 0)
            throw new InvalidOperationException("At least one reservation line is required.");

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            const string insertHead = """
                INSERT INTO dbo.InventoryReservations (
                    TenantId, OrganizationId, ReferenceCode, CustomerId, CustomerLabel,
                    ReservationDateUtc, ValidUntilUtc, Status, Notes, CreatedBy)
                OUTPUT INSERTED.InventoryReservationId
                VALUES (@TenantId, @OrganizationId, @ReferenceCode, @CustomerId, @CustomerLabel,
                    SYSUTCDATETIME(), @ValidUntilUtc, N'Active', @Notes, @CreatedBy);
                """;
            var id = await conn.QuerySingleAsync<long>(new CommandDefinition(insertHead, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                ReferenceCode = NullIfBlank(request.ReferenceCode),
                request.CustomerId,
                CustomerLabel = NullIfBlank(request.CustomerLabel),
                request.ValidUntilUtc,
                Notes = NullIfBlank(request.Notes),
                CreatedBy = NullIfBlank(actor),
            }, tx, cancellationToken: ct)).ConfigureAwait(false);

            const string insertLine = """
                INSERT INTO dbo.InventoryReservationLines (
                    InventoryReservationId, ProductVariantId, WarehouseId, BatchId, ProductSerialId,
                    Quantity, LedgerReserveTransactionId, Status)
                OUTPUT INSERTED.InventoryReservationLineId
                VALUES (@ReservationId, @ProductVariantId, @WarehouseId, @BatchId, @ProductSerialId,
                    @Quantity, @LedgerReserveTransactionId, N'Active');
                """;
            var seq = 0;
            foreach (var line in request.Lines)
            {
                seq++;
                if (line.Quantity <= 0)
                    throw new InvalidOperationException("Reservation line quantity must be positive.");
                // Post RESERVE ledger row (qty goes into Reserved bucket).
                var ledgerReq = new PostInventoryTransactionRequest(
                    line.ProductVariantId,
                    line.WarehouseId,
                    line.BatchId,
                    line.ProductSerialId,
                    InventoryTransactionTypes.Reserve,
                    InventoryQuantityBuckets.Reserved,
                    line.Quantity,
                    CostPerUnit: null,
                    SourceDocumentType: "InventoryReservation",
                    SourceDocumentId: id,
                    SourceLineId: seq,
                    IdempotencyKey: $"RSV:{id}:L{seq}",
                    Reason: $"Reserved against reservation #{id}",
                    MetadataJson: null);
                // Reuse the ledger's transaction context.
                var ledgerId = await PostReservationLedgerAsync(conn, tx, ledgerReq, actor, ct).ConfigureAwait(false);

                await conn.ExecuteAsync(new CommandDefinition(insertLine, new
                {
                    ReservationId = id,
                    line.ProductVariantId,
                    line.WarehouseId,
                    line.BatchId,
                    line.ProductSerialId,
                    line.Quantity,
                    LedgerReserveTransactionId = ledgerId,
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

    private static async Task<long> PostReservationLedgerAsync(System.Data.Common.DbConnection conn, System.Data.Common.DbTransaction tx, PostInventoryTransactionRequest req, string? actor, CancellationToken ct)
    {
        // We can't reuse InventoryLedgerRepository.PostTransactionInternalAsync because it's private.
        // Instead, we open the same logical path inline. Because PostInventoryTransactionRequest is idempotent,
        // a duplicate post during retry is a no-op.
        // For simplicity we re-open a tiny portion of the ledger insert + balance lock here.
        const string lockBalance = """
            SELECT InventoryBalanceId, OnHandQty, ReservedQty, DamagedQty, IncomingQty, InTransitQty
            FROM dbo.InventoryBalances WITH (UPDLOCK, HOLDLOCK)
            WHERE ProductVariantId = @ProductVariantId AND WarehouseId = @WarehouseId
              AND ISNULL(BatchId, 0) = ISNULL(@BatchId, 0);
            """;
        var balance = await conn.QuerySingleOrDefaultAsync<(long InventoryBalanceId, decimal OnHandQty, decimal ReservedQty, decimal DamagedQty, decimal IncomingQty, decimal InTransitQty)?>(
            new CommandDefinition(lockBalance, new { req.ProductVariantId, req.WarehouseId, req.BatchId }, tx, cancellationToken: ct)).ConfigureAwait(false);
        long balanceId;
        decimal onHand, reserved, damaged, incoming, inTransit;
        if (balance is null)
        {
            await conn.ExecuteAsync(new CommandDefinition(
                """
                INSERT INTO dbo.InventoryBalances (TenantId, OrganizationId, ProductVariantId, WarehouseId, BatchId)
                SELECT TOP 1 v.TenantId, v.OrganizationId, @ProductVariantId, @WarehouseId, @BatchId
                FROM dbo.ProductVariants v WHERE v.ProductVariantId = @ProductVariantId;
                """,
                new { req.ProductVariantId, req.WarehouseId, req.BatchId }, tx, cancellationToken: ct)).ConfigureAwait(false);
            var row = await conn.QuerySingleAsync<(long InventoryBalanceId, decimal OnHandQty, decimal ReservedQty, decimal DamagedQty, decimal IncomingQty, decimal InTransitQty)>(
                new CommandDefinition(lockBalance, new { req.ProductVariantId, req.WarehouseId, req.BatchId }, tx, cancellationToken: ct)).ConfigureAwait(false);
            balanceId = row.InventoryBalanceId;
            onHand = row.OnHandQty; reserved = row.ReservedQty; damaged = row.DamagedQty;
            incoming = row.IncomingQty; inTransit = row.InTransitQty;
        }
        else
        {
            balanceId = balance.Value.InventoryBalanceId;
            onHand = balance.Value.OnHandQty; reserved = balance.Value.ReservedQty;
            damaged = balance.Value.DamagedQty; incoming = balance.Value.IncomingQty; inTransit = balance.Value.InTransitQty;
        }

        // Insert ledger row (will fail on idempotency conflict → return existing).
        long ledgerId;
        try
        {
            const string insert = """
                INSERT INTO dbo.InventoryTransactions (
                    TenantId, OrganizationId, ProductVariantId, WarehouseId,
                    BatchId, ProductSerialId, TransactionType, QuantityBucket, QtyChange, CostPerUnit,
                    SourceDocumentType, SourceDocumentId, SourceLineId, IdempotencyKey, Reason, CreatedBy)
                OUTPUT INSERTED.InventoryTransactionId
                SELECT v.TenantId, v.OrganizationId, @ProductVariantId, @WarehouseId,
                       @BatchId, @ProductSerialId, @TransactionType, @QuantityBucket, @QtyChange, @CostPerUnit,
                       @SourceDocumentType, @SourceDocumentId, @SourceLineId, @IdempotencyKey, @Reason, @CreatedBy
                FROM dbo.ProductVariants v WHERE v.ProductVariantId = @ProductVariantId;
                """;
            ledgerId = await conn.QuerySingleAsync<long>(new CommandDefinition(insert, new
            {
                req.ProductVariantId,
                req.WarehouseId,
                req.BatchId,
                req.ProductSerialId,
                req.TransactionType,
                req.QuantityBucket,
                req.QtyChange,
                req.CostPerUnit,
                req.SourceDocumentType,
                req.SourceDocumentId,
                req.SourceLineId,
                req.IdempotencyKey,
                req.Reason,
                CreatedBy = actor,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
        }
        catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number == 2601 || ex.Number == 2627)
        {
            ledgerId = await conn.QuerySingleAsync<long>(new CommandDefinition(
                "SELECT InventoryTransactionId FROM dbo.InventoryTransactions WHERE IdempotencyKey = @Key;",
                new { Key = req.IdempotencyKey }, tx, cancellationToken: ct)).ConfigureAwait(false);
            return ledgerId;
        }

        switch (req.TransactionType.ToUpperInvariant())
        {
            case "RESERVE":
                reserved += req.QtyChange;
                break;
            case "RELEASE_RESERVATION":
                reserved = Math.Max(0, reserved - req.QtyChange);
                break;
        }

        await conn.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.InventoryBalances
            SET OnHandQty = @OnHand, ReservedQty = @Reserved, DamagedQty = @Damaged,
                IncomingQty = @Incoming, InTransitQty = @InTransit,
                LastLedgerId = @LedgerId, UpdatedUtc = SYSUTCDATETIME()
            WHERE InventoryBalanceId = @InventoryBalanceId;
            """,
            new
            {
                OnHand = onHand,
                Reserved = reserved,
                Damaged = damaged,
                Incoming = incoming,
                InTransit = inTransit,
                LedgerId = ledgerId,
                InventoryBalanceId = balanceId,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);

        return ledgerId;
    }

    public async Task<ReservationDto?> GetAsync(long reservationId, CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        const string sql = """
            SELECT r.InventoryReservationId, r.ReferenceCode, r.CustomerId, r.CustomerLabel,
                   r.ReservationDateUtc, r.ValidUntilUtc, r.Status, r.Notes, r.CreatedBy, r.CreatedUtc, r.UpdatedUtc,
                   (SELECT ISNULL(SUM(Quantity), 0) FROM dbo.InventoryReservationLines WHERE InventoryReservationId = r.InventoryReservationId) AS TotalQuantity
            FROM dbo.InventoryReservations r
            WHERE r.InventoryReservationId = @Id AND r.TenantId = @TenantId AND r.OrganizationId = @OrganizationId;

            SELECT rl.InventoryReservationLineId, rl.ProductVariantId,
                   COALESCE(v.DisplayName, p.Name) AS VariantDisplay, v.Sku,
                   rl.WarehouseId, w.Name AS WarehouseName,
                   rl.BatchId, b.BatchNumber, rl.ProductSerialId, s.SerialNumber,
                   rl.Quantity, rl.Status
            FROM dbo.InventoryReservationLines rl
            INNER JOIN dbo.ProductVariants v ON v.ProductVariantId = rl.ProductVariantId
            INNER JOIN dbo.Products p ON p.ProductId = v.ProductId
            INNER JOIN dbo.Warehouses w ON w.WarehouseId = rl.WarehouseId
            LEFT JOIN dbo.Batches b ON b.BatchId = rl.BatchId
            LEFT JOIN dbo.ProductSerials s ON s.ProductSerialId = rl.ProductSerialId
            WHERE rl.InventoryReservationId = @Id
            ORDER BY rl.InventoryReservationLineId;
            """;
        using var grid = await conn.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            Id = reservationId,
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false);
        var head = await grid.ReadSingleOrDefaultAsync<HeadRow>().ConfigureAwait(false);
        if (head is null)
            return null;
        var lines = (await grid.ReadAsync<ReservationLineDto>().ConfigureAwait(false)).AsList();
        return new ReservationDto(
            head.InventoryReservationId, head.ReferenceCode, head.CustomerId, head.CustomerLabel,
            head.ReservationDateUtc, head.ValidUntilUtc, head.Status, head.Notes, head.CreatedBy,
            head.CreatedUtc, head.UpdatedUtc, head.TotalQuantity, lines);
    }

    public async Task<IReadOnlyList<ReservationSummaryDto>> ListAsync(string? status, int skip, int take, CancellationToken ct)
    {
        const string sql = """
            SELECT r.InventoryReservationId, r.ReferenceCode, r.CustomerId, r.CustomerLabel,
                   r.ReservationDateUtc, r.ValidUntilUtc, r.Status,
                   (SELECT COUNT(1) FROM dbo.InventoryReservationLines rl WHERE rl.InventoryReservationId = r.InventoryReservationId) AS LineCount,
                   (SELECT ISNULL(SUM(Quantity), 0) FROM dbo.InventoryReservationLines rl WHERE rl.InventoryReservationId = r.InventoryReservationId) AS TotalQuantity
            FROM dbo.InventoryReservations r
            WHERE r.TenantId = @TenantId AND r.OrganizationId = @OrganizationId
              AND (@Status IS NULL OR r.Status = @Status)
            ORDER BY r.InventoryReservationId DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<ReservationSummaryDto>(new CommandDefinition(sql, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
            Status = NullIfBlank(status),
            Skip = Math.Max(0, skip),
            Take = Math.Clamp(take, 1, 200),
        }, cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<bool> ReleaseAsync(long reservationId, string? actor, CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);
        try
        {
            const string load = """
                SELECT InventoryReservationId, Status FROM dbo.InventoryReservations
                WHERE InventoryReservationId = @Id AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """;
            var head = await conn.QuerySingleOrDefaultAsync<(long Id, string Status)?>(new CommandDefinition(load, new
            {
                Id = reservationId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
            }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (head is null || !string.Equals(head.Value.Status, "Active", StringComparison.OrdinalIgnoreCase))
                return false;

            const string loadLines = """
                SELECT InventoryReservationLineId, ProductVariantId, WarehouseId, BatchId, ProductSerialId, Quantity
                FROM dbo.InventoryReservationLines WHERE InventoryReservationId = @Id AND Status = N'Active';
                """;
            var lines = (await conn.QueryAsync<(long Id, long ProductVariantId, long WarehouseId, long? BatchId, long? ProductSerialId, decimal Quantity)>(
                new CommandDefinition(loadLines, new { Id = reservationId }, tx, cancellationToken: ct)).ConfigureAwait(false)).AsList();

            var seq = 0;
            foreach (var line in lines)
            {
                seq++;
                var releaseReq = new PostInventoryTransactionRequest(
                    line.ProductVariantId, line.WarehouseId, line.BatchId, line.ProductSerialId,
                    InventoryTransactionTypes.ReleaseReservation, InventoryQuantityBuckets.Reserved,
                    QtyChange: -line.Quantity,
                    CostPerUnit: null,
                    SourceDocumentType: "InventoryReservation",
                    SourceDocumentId: reservationId,
                    SourceLineId: line.Id,
                    IdempotencyKey: $"RSVREL:{reservationId}:L{line.Id}",
                    Reason: "Reservation released",
                    MetadataJson: null);
                var ledgerId = await PostReservationLedgerAsync(conn, tx, releaseReq, actor, ct).ConfigureAwait(false);

                await conn.ExecuteAsync(new CommandDefinition(
                    """
                    UPDATE dbo.InventoryReservationLines
                    SET Status = N'Released', LedgerReleaseTransactionId = @LedgerId
                    WHERE InventoryReservationLineId = @LineId;
                    """,
                    new { LedgerId = ledgerId, LineId = line.Id }, tx, cancellationToken: ct)).ConfigureAwait(false);
            }

            await conn.ExecuteAsync(new CommandDefinition(
                """
                UPDATE dbo.InventoryReservations
                SET Status = N'Released', UpdatedUtc = SYSUTCDATETIME()
                WHERE InventoryReservationId = @Id;
                """,
                new { Id = reservationId }, tx, cancellationToken: ct)).ConfigureAwait(false);

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return true;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<bool> ExpireDueAsync(CancellationToken ct)
    {
        // Fetch active reservations whose ValidUntilUtc has passed.
        const string fetch = """
            SELECT TOP 50 InventoryReservationId FROM dbo.InventoryReservations
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
              AND Status = N'Active' AND ValidUntilUtc IS NOT NULL AND ValidUntilUtc < SYSUTCDATETIME();
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var ids = (await conn.QueryAsync<long>(new CommandDefinition(fetch, new
        {
            TenantId = _wp.TenantId,
            OrganizationId = _wp.OrganizationId,
        }, cancellationToken: ct)).ConfigureAwait(false)).AsList();

        var anyReleased = false;
        foreach (var id in ids)
        {
            if (await ReleaseAsync(id, "system:expiry", ct).ConfigureAwait(false))
                anyReleased = true;
        }
        return anyReleased;
    }

    private sealed record HeadRow(
        long InventoryReservationId, string? ReferenceCode, long? CustomerId, string? CustomerLabel,
        DateTime ReservationDateUtc, DateTime? ValidUntilUtc, string Status, string? Notes,
        string? CreatedBy, DateTime CreatedUtc, DateTime? UpdatedUtc, decimal TotalQuantity);

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
