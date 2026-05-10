using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class PurchaseRepository : IPurchaseRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public PurchaseRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<long> CreateAsync(CreatePurchaseBillRequest request, CancellationToken ct)
    {
        if (request.Lines.Count == 0)
            throw new ArgumentException("At least one line is required.", nameof(request));

        foreach (var line in request.Lines)
        {
            ThrowIfInvalidPostedLine(line);
        }

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);

        try
        {
            await VerifyVendorPartyAsync(conn, tx, request.PartyId, ct).ConfigureAwait(false);

            const string insertBill = """
                INSERT INTO dbo.PurchaseBills (TenantId, OrganizationId, PartyId, PurchaseNumber, ReceivedUtc, Currency, TotalAmount, Status)
                OUTPUT INSERTED.PurchaseBillId
                VALUES (@TenantId, @OrganizationId, @PartyId, NULL, SYSUTCDATETIME(), N'INR', 0, N'Draft');
                """;
            var billId = await conn.QuerySingleAsync<long>(
                new CommandDefinition(insertBill,
                    new
                    {
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                        request.PartyId,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);

            decimal total = 0;
            foreach (var line in request.Lines)
            {
                var lineTotal = await AppendPurchaseLineAsync(conn, tx, billId, line, bumpPhysicalStock: true, ct).ConfigureAwait(false);
                total += lineTotal;
            }

            total = decimal.Round(total, 2, MidpointRounding.AwayFromZero);
            var purchaseNumber = $"PUR-{billId:D6}";
            const string updateBill = """
                UPDATE dbo.PurchaseBills
                SET TotalAmount = @TotalAmount, PurchaseNumber = @PurchaseNumber, Status = N'Posted'
                WHERE PurchaseBillId = @PurchaseBillId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """;
            await conn.ExecuteAsync(
                new CommandDefinition(updateBill,
                    new
                    {
                        TotalAmount = total,
                        PurchaseNumber = purchaseNumber,
                        PurchaseBillId = billId,
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return billId;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<long> CreateDraftAsync(CreatePurchaseBillRequest request, CancellationToken ct)
    {
        var normalized = NormalizeDraftLines(request.Lines);

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);

        try
        {
            await VerifyVendorPartyAsync(conn, tx, request.PartyId, ct).ConfigureAwait(false);

            const string insertBill = """
                INSERT INTO dbo.PurchaseBills (TenantId, OrganizationId, PartyId, PurchaseNumber, ReceivedUtc, Currency, TotalAmount, Status)
                OUTPUT INSERTED.PurchaseBillId
                VALUES (@TenantId, @OrganizationId, @PartyId, NULL, SYSUTCDATETIME(), N'INR', 0, N'Draft');
                """;
            var billId = await conn.QuerySingleAsync<long>(
                new CommandDefinition(insertBill,
                    new
                    {
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                        request.PartyId,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);

            decimal total = 0;
            foreach (var line in normalized)
            {
                var lt = await AppendPurchaseLineAsync(conn, tx, billId, line, bumpPhysicalStock: false, ct).ConfigureAwait(false);
                total += lt;
            }

            total = decimal.Round(total, 2, MidpointRounding.AwayFromZero);
            const string updateTotalsOnly = """
                UPDATE dbo.PurchaseBills
                SET TotalAmount = @TotalAmount
                WHERE PurchaseBillId = @PurchaseBillId AND TenantId = @TenantId AND OrganizationId = @OrganizationId AND Status = N'Draft';
                """;
            var rows = await conn.ExecuteAsync(
                new CommandDefinition(updateTotalsOnly,
                    new
                    {
                        TotalAmount = total,
                        PurchaseBillId = billId,
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (rows != 1)
                throw new InvalidOperationException("Draft bill header could not be updated.");

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return billId;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<bool> UpdateDraftAsync(long purchaseBillId, CreatePurchaseBillRequest request, CancellationToken ct)
    {
        var normalized = NormalizeDraftLines(request.Lines);

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);

        try
        {
            await VerifyVendorPartyAsync(conn, tx, request.PartyId, ct).ConfigureAwait(false);

            const string verifyDraft = """
                SELECT Status FROM dbo.PurchaseBills
                WHERE PurchaseBillId = @PurchaseBillId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """;
            var status = await conn.QuerySingleOrDefaultAsync<string>(
                new CommandDefinition(verifyDraft,
                    new { PurchaseBillId = purchaseBillId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                    cancellationToken: ct)).ConfigureAwait(false);
            if (status is null)
                return false;
            if (!string.Equals(status, "Draft", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Only draft bills can be edited.");

            const string updateParty = """
                UPDATE dbo.PurchaseBills
                SET PartyId = @PartyId
                WHERE PurchaseBillId = @PurchaseBillId AND TenantId = @TenantId AND OrganizationId = @OrganizationId AND Status = N'Draft';
                """;
            await conn.ExecuteAsync(
                new CommandDefinition(updateParty,
                    new
                    {
                        PartyId = request.PartyId,
                        PurchaseBillId = purchaseBillId,
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);

            const string deleteLines = """
                DELETE FROM dbo.PurchaseLines WHERE PurchaseBillId = @PurchaseBillId;
                """;
            await conn.ExecuteAsync(
                new CommandDefinition(deleteLines, new { PurchaseBillId = purchaseBillId }, tx, cancellationToken: ct)).ConfigureAwait(false);

            decimal total = 0;
            foreach (var line in normalized)
            {
                var lt = await AppendPurchaseLineAsync(conn, tx, purchaseBillId, line, bumpPhysicalStock: false, ct).ConfigureAwait(false);
                total += lt;
            }

            total = decimal.Round(total, 2, MidpointRounding.AwayFromZero);
            const string updateTotalsOnly = """
                UPDATE dbo.PurchaseBills
                SET TotalAmount = @TotalAmount
                WHERE PurchaseBillId = @PurchaseBillId AND TenantId = @TenantId AND OrganizationId = @OrganizationId AND Status = N'Draft';
                """;
            var rows = await conn.ExecuteAsync(
                new CommandDefinition(updateTotalsOnly,
                    new
                    {
                        TotalAmount = total,
                        PurchaseBillId = purchaseBillId,
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (rows != 1)
                throw new InvalidOperationException("Draft bill header could not be updated.");

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return true;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<bool> PostDraftAsync(long purchaseBillId, CancellationToken ct)
    {
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);

        try
        {
            const string verifyDraft = """
                SELECT pb.Status AS Status, pb.PartyId AS PartyId
                FROM dbo.PurchaseBills pb
                WHERE pb.PurchaseBillId = @PurchaseBillId AND pb.TenantId = @TenantId AND pb.OrganizationId = @OrganizationId;
                """;
            var head = await conn.QuerySingleOrDefaultAsync<DraftBillHeadRow>(
                new CommandDefinition(verifyDraft,
                    new { PurchaseBillId = purchaseBillId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                    cancellationToken: ct)).ConfigureAwait(false);
            if (head is null)
                return false;
            if (!string.Equals(head.Status, "Draft", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Only draft bills can be posted.");

            await VerifyVendorPartyAsync(conn, tx, head.PartyId, ct).ConfigureAwait(false);

            const string linesSql = """
                SELECT ProductId, Description, Quantity, UnitCost, DiscountPercent, DiscountAmount, TaxRatePercent
                FROM dbo.PurchaseLines WHERE PurchaseBillId = @PurchaseBillId ORDER BY PurchaseLineId;
                """;
            var rowsFromDb = (await conn.QueryAsync<DraftLineRow>(
                new CommandDefinition(linesSql, new { PurchaseBillId = purchaseBillId }, tx, cancellationToken: ct)).ConfigureAwait(false)).AsList();

            var normalized = rowsFromDb
                .Where(r => r.Quantity > 0 && !string.IsNullOrWhiteSpace(r.Description))
                .Select(r => new CreatePurchaseLineRequest(r.ProductId, r.Description.Trim(), r.Quantity, r.UnitCost, r.DiscountPercent,
                    r.DiscountAmount, r.TaxRatePercent))
                .ToList();

            if (normalized.Count == 0)
                throw new InvalidOperationException("Draft must contain at least one line with quantity and description before posting.");

            foreach (var line in normalized)
            {
                ThrowIfInvalidPostedLine(line);
            }

            foreach (var line in normalized)
            {
                await BumpPhysicalStockIfNeededAsync(conn, tx, line, ct).ConfigureAwait(false);
            }

            const string sumTotals = """
                SELECT COALESCE(SUM(LineTotal), 0) FROM dbo.PurchaseLines WHERE PurchaseBillId = @PurchaseBillId;
                """;
            var total = await conn.QuerySingleAsync<decimal>(
                new CommandDefinition(sumTotals, new { PurchaseBillId = purchaseBillId }, tx, cancellationToken: ct)).ConfigureAwait(false);
            total = decimal.Round(total, 2, MidpointRounding.AwayFromZero);
            var purchaseNumber = $"PUR-{purchaseBillId:D6}";
            const string updateBill = """
                UPDATE dbo.PurchaseBills
                SET TotalAmount = @TotalAmount, PurchaseNumber = @PurchaseNumber, Status = N'Posted'
                WHERE PurchaseBillId = @PurchaseBillId AND TenantId = @TenantId AND OrganizationId = @OrganizationId AND Status = N'Draft';
                """;
            var updated = await conn.ExecuteAsync(
                new CommandDefinition(updateBill,
                    new
                    {
                        TotalAmount = total,
                        PurchaseNumber = purchaseNumber,
                        PurchaseBillId = purchaseBillId,
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);
            if (updated != 1)
                throw new InvalidOperationException("Could not finalize draft bill.");

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return true;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<IReadOnlyList<PurchaseBillSummaryDto>> ListAsync(int skip, int take, string? statusFilter, DateTime? receivedFromUtc, DateTime? receivedToUtcExclusive, CancellationToken ct)
    {
        const string sql = """
            SELECT pb.PurchaseBillId,
                   pb.PurchaseNumber,
                   pb.PartyId,
                   p.DisplayName AS SupplierName,
                   pb.ReceivedUtc,
                   pb.TotalAmount,
                   pb.Status,
                   CAST(0 AS DECIMAL(18,2)) AS AmountPaid,
                   pb.TotalAmount AS BalanceDue
            FROM dbo.PurchaseBills pb
            INNER JOIN dbo.Parties p ON p.PartyId = pb.PartyId AND p.TenantId = pb.TenantId AND p.OrganizationId = pb.OrganizationId
            WHERE pb.TenantId = @TenantId AND pb.OrganizationId = @OrganizationId
              AND (@StatusFilter IS NULL OR pb.Status = @StatusFilter)
              AND (@ReceivedFromUtc IS NULL OR pb.ReceivedUtc >= @ReceivedFromUtc)
              AND (@ReceivedToUtcExclusive IS NULL OR pb.ReceivedUtc < @ReceivedToUtcExclusive)
            ORDER BY pb.PurchaseBillId DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<PurchaseBillSummaryDto>(
            new CommandDefinition(sql,
                new
                {
                    Skip = skip,
                    Take = take,
                    TenantId = _wp.TenantId,
                    OrganizationId = _wp.OrganizationId,
                    StatusFilter = string.IsNullOrWhiteSpace(statusFilter) ? null : statusFilter.Trim(),
                    ReceivedFromUtc = receivedFromUtc,
                    ReceivedToUtcExclusive = receivedToUtcExclusive,
                },
                cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<PurchaseBillDetailDto?> GetDetailAsync(long purchaseBillId, CancellationToken ct)
    {
        const string headSql = """
            SELECT pb.PurchaseBillId, pb.PurchaseNumber, pb.PartyId, p.DisplayName AS SupplierName, pb.ReceivedUtc, pb.Currency, pb.TotalAmount, pb.Status
            FROM dbo.PurchaseBills pb
            INNER JOIN dbo.Parties p ON p.PartyId = pb.PartyId AND p.TenantId = pb.TenantId AND p.OrganizationId = pb.OrganizationId
            WHERE pb.PurchaseBillId = @PurchaseBillId AND pb.TenantId = @TenantId AND pb.OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var head = await conn.QuerySingleOrDefaultAsync<PurchaseHeadRow>(
            new CommandDefinition(headSql,
                new { PurchaseBillId = purchaseBillId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        if (head is null)
            return null;

        const string linesSql = """
            SELECT PurchaseLineId, ProductId, Description, Quantity, UnitCost,
              DiscountPercent, DiscountAmount, TaxRatePercent, TaxableAmount, TaxAmount, LineTotal
            FROM dbo.PurchaseLines WHERE PurchaseBillId = @PurchaseBillId ORDER BY PurchaseLineId;
            """;
        var lines = await conn.QueryAsync<PurchaseLineDto>(
            new CommandDefinition(linesSql, new { PurchaseBillId = purchaseBillId }, cancellationToken: ct)).ConfigureAwait(false);

        return new PurchaseBillDetailDto(
            head.PurchaseBillId,
            head.PurchaseNumber,
            head.PartyId,
            head.SupplierName,
            head.ReceivedUtc,
            head.Currency,
            head.TotalAmount,
            head.Status,
            lines.AsList());
    }

    private async Task VerifyVendorPartyAsync(System.Data.Common.DbConnection conn, System.Data.Common.DbTransaction tx, long partyId, CancellationToken ct)
    {
        const string verifyParty = """
            SELECT Kind, IsActive FROM dbo.Parties
            WHERE PartyId = @PartyId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        var party = await conn.QuerySingleOrDefaultAsync<PartyVerifyRow>(
            new CommandDefinition(verifyParty,
                new { PartyId = partyId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                cancellationToken: ct)).ConfigureAwait(false);
        if (party is null)
            throw new InvalidOperationException("Supplier not found in this organization.");
        if (!party.IsActive)
            throw new InvalidOperationException("Supplier party is inactive.");
        if (!string.Equals(party.Kind, PartyKinds.Vendor, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Purchase bills must use a party with kind Vendor.");
    }

    private static List<CreatePurchaseLineRequest> NormalizeDraftLines(IReadOnlyList<CreatePurchaseLineRequest> lines)
    {
        var normalized = new List<CreatePurchaseLineRequest>();
        foreach (var line in lines)
        {
            var desc = line.Description.Trim();
            if (line.Quantity <= 0 || string.IsNullOrWhiteSpace(desc))
                continue;
            ThrowIfInvalidPostedLine(line with { Description = desc });
            normalized.Add(line with { Description = desc });
        }

        return normalized;
    }

    private static void ThrowIfInvalidPostedLine(CreatePurchaseLineRequest line)
    {
        if (string.IsNullOrWhiteSpace(line.Description))
            throw new ArgumentException("Each line requires a description.", nameof(line));
        if (line.Quantity <= 0)
            throw new ArgumentException("Line quantity must be greater than zero.", nameof(line));
        if (line.DiscountPercent < 0 || line.DiscountPercent > 100)
            throw new ArgumentException("Line discount percent must be between 0 and 100.", nameof(line));
        if (line.DiscountAmount < 0)
            throw new ArgumentException("Line discount amount cannot be negative.", nameof(line));
        if (line.TaxRatePercent < 0 || line.TaxRatePercent > 100)
            throw new ArgumentException("Line tax rate must be between 0 and 100.", nameof(line));
    }

    private async Task<decimal> AppendPurchaseLineAsync(
        System.Data.Common.DbConnection conn,
        System.Data.Common.DbTransaction tx,
        long billId,
        CreatePurchaseLineRequest line,
        bool bumpPhysicalStock,
        CancellationToken ct)
    {
        var desc = line.Description.Trim();
        var (taxable, taxAmt, lineTotal) = ComputePurchaseLineTotals(
            line.Quantity, line.UnitCost, line.DiscountPercent, line.DiscountAmount, line.TaxRatePercent);

        const string insertLine = """
            INSERT INTO dbo.PurchaseLines (
              PurchaseBillId, ProductId, Description, Quantity, UnitCost,
              DiscountPercent, DiscountAmount, TaxRatePercent, TaxableAmount, TaxAmount, LineTotal)
            VALUES (
              @PurchaseBillId, @ProductId, @Description, @Quantity, @UnitCost,
              @DiscountPercent, @DiscountAmount, @TaxRatePercent, @TaxableAmount, @TaxAmount, @LineTotal);
            """;

        await conn.ExecuteAsync(new CommandDefinition(insertLine, new
        {
            PurchaseBillId = billId,
            ProductId = line.ProductId,
            Description = desc,
            Quantity = line.Quantity,
            UnitCost = line.UnitCost,
            DiscountPercent = line.DiscountPercent,
            DiscountAmount = line.DiscountAmount,
            TaxRatePercent = line.TaxRatePercent,
            TaxableAmount = taxable,
            TaxAmount = taxAmt,
            LineTotal = lineTotal,
        }, tx, cancellationToken: ct)).ConfigureAwait(false);

        if (bumpPhysicalStock && line.ProductId.HasValue)
        {
            await BumpPhysicalStockIfNeededAsync(conn, tx,
                new CreatePurchaseLineRequest(line.ProductId, desc, line.Quantity, line.UnitCost, line.DiscountPercent, line.DiscountAmount,
                    line.TaxRatePercent), ct).ConfigureAwait(false);
        }

        return lineTotal;
    }

    private async Task BumpPhysicalStockIfNeededAsync(
        System.Data.Common.DbConnection conn,
        System.Data.Common.DbTransaction tx,
        CreatePurchaseLineRequest line,
        CancellationToken ct)
    {
        if (!line.ProductId.HasValue)
            return;

        const string prodMeta = """
            SELECT IsService FROM dbo.Products
            WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        var isService = await conn.QuerySingleOrDefaultAsync<bool?>(
            new CommandDefinition(prodMeta,
                new { ProductId = line.ProductId.Value, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId },
                tx, cancellationToken: ct)).ConfigureAwait(false);
        if (isService is null)
            throw new InvalidOperationException($"Product {line.ProductId.Value} not found in this organization.");

        if (isService.Value)
            return;

        const string bumpStock = """
            UPDATE dbo.Products
            SET StockQty = StockQty + @Delta
            WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        var rows = await conn.ExecuteAsync(
            new CommandDefinition(bumpStock,
                new
                {
                    Delta = line.Quantity,
                    ProductId = line.ProductId.Value,
                    TenantId = _wp.TenantId,
                    OrganizationId = _wp.OrganizationId,
                }, tx, cancellationToken: ct)).ConfigureAwait(false);
        if (rows != 1)
            throw new InvalidOperationException($"Could not update stock for product {line.ProductId.Value}.");
    }

    private sealed record DraftBillHeadRow(string Status, long PartyId);

    private sealed record DraftLineRow(
        long? ProductId,
        string Description,
        decimal Quantity,
        decimal UnitCost,
        decimal DiscountPercent,
        decimal DiscountAmount,
        decimal TaxRatePercent);

    private sealed record PurchaseHeadRow(
        long PurchaseBillId,
        string? PurchaseNumber,
        long PartyId,
        string SupplierName,
        DateTime ReceivedUtc,
        string Currency,
        decimal TotalAmount,
        string Status);

    private sealed record PartyVerifyRow(string Kind, bool IsActive);

    /// <summary>
    /// Purchase rate is tax-exclusive. Discount % applies to line gross (qty × unit), then fixed discount amount,
    /// then GST % on taxable base (CGST+SGST combined rate for intrastate — split reporting can come later).
    /// </summary>
    private static (decimal TaxableAmount, decimal TaxAmount, decimal LineTotal) ComputePurchaseLineTotals(
        decimal quantity,
        decimal unitCost,
        decimal discountPercent,
        decimal discountAmount,
        decimal taxRatePercent)
    {
        var gross = decimal.Round(quantity * unitCost, 4, MidpointRounding.AwayFromZero);
        var dp = Math.Clamp(discountPercent, 0m, 100m);
        var afterPct = gross * (1 - dp / 100m);
        var da = Math.Max(0, discountAmount);
        var taxable = afterPct - da;
        if (taxable < 0)
            taxable = 0;
        taxable = decimal.Round(taxable, 2, MidpointRounding.AwayFromZero);
        var tr = Math.Clamp(taxRatePercent, 0m, 100m);
        var tax = decimal.Round(taxable * tr / 100m, 2, MidpointRounding.AwayFromZero);
        var lineTotal = decimal.Round(taxable + tax, 2, MidpointRounding.AwayFromZero);
        return (taxable, tax, lineTotal);
    }
}
