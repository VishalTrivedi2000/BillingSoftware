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
            if (line.Quantity <= 0)
                throw new ArgumentException("Line quantity must be greater than zero.", nameof(request));
            if (string.IsNullOrWhiteSpace(line.Description))
                throw new ArgumentException("Each line requires a description.", nameof(request));
        }

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);

        try
        {
            const string verifyParty = """
                SELECT Kind, IsActive FROM dbo.Parties
                WHERE PartyId = @PartyId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """;
            var party = await conn.QuerySingleOrDefaultAsync<PartyVerifyRow>(
                new CommandDefinition(verifyParty,
                    new { request.PartyId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                    cancellationToken: ct)).ConfigureAwait(false);
            if (party is null)
                throw new InvalidOperationException("Supplier not found in this organization.");
            if (!party.IsActive)
                throw new InvalidOperationException("Supplier party is inactive.");
            if (!string.Equals(party.Kind, PartyKinds.Vendor, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Purchase bills must use a party with kind Vendor.");

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
            const string insertLine = """
                INSERT INTO dbo.PurchaseLines (PurchaseBillId, ProductId, Description, Quantity, UnitCost, LineTotal)
                VALUES (@PurchaseBillId, @ProductId, @Description, @Quantity, @UnitCost, @LineTotal);
                """;

            const string bumpStock = """
                UPDATE dbo.Products
                SET StockQty = StockQty + @Delta
                WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """;

            foreach (var line in request.Lines)
            {
                var lineTotal = decimal.Round(line.Quantity * line.UnitCost, 2, MidpointRounding.AwayFromZero);
                total += lineTotal;

                await conn.ExecuteAsync(new CommandDefinition(insertLine, new
                {
                    PurchaseBillId = billId,
                    ProductId = line.ProductId,
                    Description = line.Description.Trim(),
                    Quantity = line.Quantity,
                    UnitCost = line.UnitCost,
                    LineTotal = lineTotal,
                }, tx, cancellationToken: ct)).ConfigureAwait(false);

                if (line.ProductId.HasValue)
                {
                    const string verifyProd = """
                        SELECT COUNT(1) FROM dbo.Products
                        WHERE ProductId = @ProductId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                        """;
                    var pc = await conn.ExecuteScalarAsync<int>(
                        new CommandDefinition(verifyProd,
                            new { ProductId = line.ProductId.Value, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId },
                            tx, cancellationToken: ct)).ConfigureAwait(false);
                    if (pc == 0)
                        throw new InvalidOperationException($"Product {line.ProductId.Value} not found in this organization.");

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

    public async Task<IReadOnlyList<PurchaseBillSummaryDto>> ListAsync(int skip, int take, CancellationToken ct)
    {
        const string sql = """
            SELECT pb.PurchaseBillId, pb.PurchaseNumber, pb.PartyId, p.DisplayName AS SupplierName, pb.ReceivedUtc, pb.TotalAmount, pb.Status
            FROM dbo.PurchaseBills pb
            INNER JOIN dbo.Parties p ON p.PartyId = pb.PartyId AND p.TenantId = pb.TenantId AND p.OrganizationId = pb.OrganizationId
            WHERE pb.TenantId = @TenantId AND pb.OrganizationId = @OrganizationId
            ORDER BY pb.PurchaseBillId DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<PurchaseBillSummaryDto>(
            new CommandDefinition(sql,
                new { Skip = skip, Take = take, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId },
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
            SELECT PurchaseLineId, ProductId, Description, Quantity, UnitCost, LineTotal
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
}
