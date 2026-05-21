using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class InvoiceRepository : IInvoiceRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public InvoiceRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<long> CreateAsync(CreateInvoiceRequest request, CancellationToken ct)
    {
        if (request.Lines.Count == 0)
            throw new ArgumentException("At least one invoice line is required.", nameof(request));

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
            const string verifyCustomer = """
                SELECT COUNT(1) FROM dbo.Customers
                WHERE CustomerId = @CustomerId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """;
            var custCount = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(verifyCustomer,
                    new { request.CustomerId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                    cancellationToken: ct)).ConfigureAwait(false);
            if (custCount == 0)
                throw new InvalidOperationException("Customer not found in this organization.");

            const string insertInv = """
                INSERT INTO dbo.Invoices (TenantId, OrganizationId, CustomerId, InvoiceNumber, IssueUtc, Currency, TotalAmount, Status)
                OUTPUT INSERTED.InvoiceId
                VALUES (@TenantId, @OrganizationId, @CustomerId, NULL, SYSUTCDATETIME(), N'INR', 0, N'Draft');
                """;
            var invoiceId = await conn.QuerySingleAsync<long>(
                new CommandDefinition(insertInv,
                    new
                    {
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                        request.CustomerId,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);

            decimal total = 0;
            const string insertLine = """
                INSERT INTO dbo.InvoiceLines (InvoiceId, ProductId, Description, Quantity, UnitPrice, LineTotal)
                OUTPUT INSERTED.InvoiceLineId
                VALUES (@InvoiceId, @ProductId, @Description, @Quantity, @UnitPrice, @LineTotal);
                """;

            const string verifySerial = """
                SELECT s.ProductSerialId, s.ProductVariantId, s.Status, s.PurchaseCostPerUnit
                FROM dbo.ProductSerials s
                WHERE s.ProductSerialId = @ProductSerialId
                  AND s.TenantId = @TenantId AND s.OrganizationId = @OrganizationId AND s.IsDeleted = 0;
                """;

            const string insertLineSerial = """
                INSERT INTO dbo.SalesInvoiceLineSerials (
                    TenantId, OrganizationId, InvoiceLineId, ProductSerialId, SellingPrice, CostPrice, GrossProfit)
                VALUES (@TenantId, @OrganizationId, @InvoiceLineId, @ProductSerialId, @SellingPrice, @CostPrice, @GrossProfit);
                """;

            const string markSerialSold = """
                UPDATE dbo.ProductSerials
                SET Status = N'Sold', SoldInvoiceLineId = @InvoiceLineId, UpdatedUtc = SYSUTCDATETIME()
                WHERE ProductSerialId = @ProductSerialId
                  AND TenantId = @TenantId AND OrganizationId = @OrganizationId AND IsDeleted = 0
                  AND Status IN (N'Available', N'InStock');
                """;

            foreach (var line in request.Lines)
            {
                var lineTotal = decimal.Round(line.Quantity * line.UnitPrice, 2, MidpointRounding.AwayFromZero);
                total += lineTotal;
                var invoiceLineId = await conn.QuerySingleAsync<long>(new CommandDefinition(insertLine, new
                {
                    InvoiceId = invoiceId,
                    ProductId = line.ProductId,
                    Description = line.Description.Trim(),
                    Quantity = line.Quantity,
                    UnitPrice = line.UnitPrice,
                    LineTotal = lineTotal,
                }, tx, cancellationToken: ct)).ConfigureAwait(false);

                var serialIds = line.ProductSerialIds;
                if (serialIds is null || serialIds.Count == 0)
                    continue;

                if (serialIds.Count != (int)decimal.Truncate(line.Quantity))
                    throw new InvalidOperationException(
                        $"Line \"{line.Description.Trim()}\": quantity must match the number of IMEI/serial units selected ({serialIds.Count}).");

                var seenSerials = new HashSet<long>();
                foreach (var serialId in serialIds)
                {
                    if (!seenSerials.Add(serialId))
                        throw new InvalidOperationException("Duplicate IMEI/serial on the same invoice line.");

                    var serial = await conn.QuerySingleOrDefaultAsync<(long ProductSerialId, long ProductVariantId, string Status, decimal? PurchaseCostPerUnit)?>(
                        new CommandDefinition(verifySerial,
                            new
                            {
                                ProductSerialId = serialId,
                                TenantId = _wp.TenantId,
                                OrganizationId = _wp.OrganizationId,
                            }, tx, cancellationToken: ct)).ConfigureAwait(false);

                    if (serial is null)
                        throw new InvalidOperationException($"IMEI/serial #{serialId} was not found.");

                    if (!string.Equals(serial.Value.Status, "Available", StringComparison.OrdinalIgnoreCase)
                        && !string.Equals(serial.Value.Status, "InStock", StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException(
                            $"IMEI/serial #{serialId} is not available (status: {serial.Value.Status}).");

                    if (line.ProductVariantId is { } variantId && serial.Value.ProductVariantId != variantId)
                        throw new InvalidOperationException(
                            $"IMEI/serial #{serialId} does not belong to the selected variant.");

                    var unitSell = line.UnitPrice;
                    var unitCost = serial.Value.PurchaseCostPerUnit ?? 0m;
                    var gross = decimal.Round(unitSell - unitCost, 2, MidpointRounding.AwayFromZero);

                    await conn.ExecuteAsync(new CommandDefinition(insertLineSerial, new
                    {
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                        InvoiceLineId = invoiceLineId,
                        ProductSerialId = serialId,
                        SellingPrice = unitSell,
                        CostPrice = unitCost,
                        GrossProfit = gross,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);

                    var updated = await conn.ExecuteAsync(new CommandDefinition(markSerialSold, new
                    {
                        InvoiceLineId = invoiceLineId,
                        ProductSerialId = serialId,
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);

                    if (updated == 0)
                        throw new InvalidOperationException($"IMEI/serial #{serialId} could not be marked sold.");
                }
            }

            total = decimal.Round(total, 2, MidpointRounding.AwayFromZero);
            var invoiceNumber = $"INV-{invoiceId:D6}";
            const string updateInv = """
                UPDATE dbo.Invoices SET TotalAmount = @TotalAmount, InvoiceNumber = @InvoiceNumber, Status = N'Posted'
                WHERE InvoiceId = @InvoiceId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                """;
            await conn.ExecuteAsync(
                new CommandDefinition(updateInv,
                    new
                    {
                        TotalAmount = total,
                        InvoiceNumber = invoiceNumber,
                        InvoiceId = invoiceId,
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                    }, tx,
                    cancellationToken: ct)).ConfigureAwait(false);

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return invoiceId;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<IReadOnlyList<InvoiceSummaryDto>> ListAsync(int skip, int take, DateTime? issueFromUtc, DateTime? issueToUtcExclusive, CancellationToken ct)
    {
        const string sql = """
            SELECT i.InvoiceId,
                   i.InvoiceNumber,
                   i.CustomerId,
                   c.Name AS CustomerName,
                   i.IssueUtc,
                   i.TotalAmount,
                   i.Status,
                   ISNULL(paid.AmountPaid, 0) AS AmountPaid,
                   i.TotalAmount - ISNULL(paid.AmountPaid, 0) AS BalanceDue,
                   lp.Channel AS LastPaymentChannel
            FROM dbo.Invoices i
            INNER JOIN dbo.Customers c ON c.CustomerId = i.CustomerId AND c.TenantId = i.TenantId AND c.OrganizationId = i.OrganizationId
            LEFT JOIN (
                SELECT InvoiceId, SUM(Amount) AS AmountPaid
                FROM dbo.InvoicePayments
                WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
                GROUP BY InvoiceId
            ) paid ON paid.InvoiceId = i.InvoiceId
            OUTER APPLY (
                SELECT TOP 1 ip.Channel
                FROM dbo.InvoicePayments ip
                WHERE ip.InvoiceId = i.InvoiceId AND ip.TenantId = @TenantId AND ip.OrganizationId = @OrganizationId
                ORDER BY ip.ReceivedUtc DESC, ip.InvoicePaymentId DESC
            ) lp
            WHERE i.TenantId = @TenantId AND i.OrganizationId = @OrganizationId
              AND (@IssueFromUtc IS NULL OR i.IssueUtc >= @IssueFromUtc)
              AND (@IssueToUtcExclusive IS NULL OR i.IssueUtc < @IssueToUtcExclusive)
            ORDER BY i.InvoiceId DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<InvoiceSummaryDto>(
            new CommandDefinition(sql,
                new
                {
                    Skip = skip,
                    Take = take,
                    TenantId = _wp.TenantId,
                    OrganizationId = _wp.OrganizationId,
                    IssueFromUtc = issueFromUtc,
                    IssueToUtcExclusive = issueToUtcExclusive,
                },
                cancellationToken: ct)).ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<InvoiceDetailDto?> GetDetailAsync(long invoiceId, CancellationToken ct)
    {
        const string headSql = """
            SELECT i.InvoiceId, i.InvoiceNumber, i.CustomerId, c.Name AS CustomerName, i.IssueUtc, i.Currency, i.TotalAmount, i.Status
            FROM dbo.Invoices i
            INNER JOIN dbo.Customers c ON c.CustomerId = i.CustomerId AND c.TenantId = i.TenantId AND c.OrganizationId = i.OrganizationId
            WHERE i.InvoiceId = @InvoiceId AND i.TenantId = @TenantId AND i.OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var head = await conn.QuerySingleOrDefaultAsync<InvoiceHeadRow>(
            new CommandDefinition(headSql,
                new { InvoiceId = invoiceId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        if (head is null)
            return null;

        const string linesSql = """
            SELECT InvoiceLineId, ProductId, Description, Quantity, UnitPrice, LineTotal
            FROM dbo.InvoiceLines WHERE InvoiceId = @InvoiceId ORDER BY InvoiceLineId;
            """;
        var lines = await conn.QueryAsync<InvoiceLineDto>(
            new CommandDefinition(linesSql, new { InvoiceId = invoiceId }, cancellationToken: ct)).ConfigureAwait(false);

        const string paidSql = """
                               SELECT ISNULL(SUM(Amount), 0)
                               FROM dbo.InvoicePayments
                               WHERE InvoiceId = @InvoiceId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                               """;
        var amountPaid = await conn.ExecuteScalarAsync<decimal>(
            new CommandDefinition(paidSql,
                new { InvoiceId = invoiceId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct)).ConfigureAwait(false);
        amountPaid = decimal.Round(amountPaid, 2, MidpointRounding.AwayFromZero);

        const string paymentsSql = """
                                   SELECT InvoicePaymentId, Amount, ReceivedUtc, Channel, ReferenceNote
                                   FROM dbo.InvoicePayments
                                   WHERE InvoiceId = @InvoiceId AND TenantId = @TenantId AND OrganizationId = @OrganizationId
                                   ORDER BY ReceivedUtc DESC, InvoicePaymentId DESC;
                                   """;
        var payments = await conn.QueryAsync<InvoicePaymentEntryDto>(
            new CommandDefinition(paymentsSql,
                new { InvoiceId = invoiceId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct)).ConfigureAwait(false);

        var balanceDue = decimal.Round(head.TotalAmount - amountPaid, 2, MidpointRounding.AwayFromZero);

        return new InvoiceDetailDto(
            head.InvoiceId,
            head.InvoiceNumber,
            head.CustomerId,
            head.CustomerName,
            head.IssueUtc,
            head.Currency,
            head.TotalAmount,
            head.Status,
            lines.AsList(),
            amountPaid,
            balanceDue,
            payments.AsList());
    }

    public async Task<long> RecordPaymentAsync(long invoiceId, RecordInvoicePaymentRequest request, CancellationToken ct)
    {
        if (request.Amount <= 0)
            throw new ArgumentException("Amount must be greater than zero.", nameof(request));

        var receivedUtc = request.ReceivedUtc ?? DateTime.UtcNow;
        var channel = string.IsNullOrWhiteSpace(request.Channel) ? null : request.Channel.Trim();
        if (channel is { Length: > 64 })
            channel = channel[..64];
        var referenceNote = string.IsNullOrWhiteSpace(request.ReferenceNote) ? null : request.ReferenceNote.Trim();
        if (referenceNote is { Length: > 256 })
            referenceNote = referenceNote[..256];

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await using var tx = await conn.BeginTransactionAsync(ct).ConfigureAwait(false);

        try
        {
            const string lockInv = """
                                   SELECT InvoiceId, TotalAmount, Status
                                   FROM dbo.Invoices WITH (UPDLOCK, ROWLOCK)
                                   WHERE InvoiceId = @InvoiceId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                                   """;
            var inv = await conn.QuerySingleOrDefaultAsync<InvLockRow>(
                new CommandDefinition(lockInv,
                    new { InvoiceId = invoiceId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                    cancellationToken: ct)).ConfigureAwait(false);
            if (inv is null)
                throw new InvalidOperationException("Invoice not found in this organization.");

            if (string.Equals(inv.Status, "Paid", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("This invoice is already fully settled.");
            if (!string.Equals(inv.Status, "Posted", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Settlements can only be recorded for posted invoices.");

            var total = inv.TotalAmount;

            const string sumPaid = """
                                   SELECT ISNULL(SUM(Amount), 0)
                                   FROM dbo.InvoicePayments
                                   WHERE InvoiceId = @InvoiceId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                                   """;
            var paidSoFar = await conn.ExecuteScalarAsync<decimal>(
                new CommandDefinition(sumPaid,
                    new { InvoiceId = invoiceId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                    cancellationToken: ct)).ConfigureAwait(false);
            paidSoFar = decimal.Round(paidSoFar, 2, MidpointRounding.AwayFromZero);
            var amt = decimal.Round(request.Amount, 2, MidpointRounding.AwayFromZero);
            var newTotalPaid = decimal.Round(paidSoFar + amt, 2, MidpointRounding.AwayFromZero);
            if (newTotalPaid > total + 0.01m)
                throw new ArgumentException("This receipt would exceed the invoice total.", nameof(request));

            const string insertPay = """
                                     INSERT INTO dbo.InvoicePayments (TenantId, OrganizationId, InvoiceId, Amount, ReceivedUtc, Channel, ReferenceNote)
                                     OUTPUT INSERTED.InvoicePaymentId
                                     VALUES (@TenantId, @OrganizationId, @InvoiceId, @Amount, @ReceivedUtc, @Channel, @ReferenceNote);
                                     """;
            var paymentId = await conn.QuerySingleAsync<long>(
                new CommandDefinition(insertPay,
                    new
                    {
                        TenantId = _wp.TenantId,
                        OrganizationId = _wp.OrganizationId,
                        InvoiceId = invoiceId,
                        Amount = amt,
                        ReceivedUtc = receivedUtc,
                        Channel = channel,
                        ReferenceNote = referenceNote,
                    }, tx, cancellationToken: ct)).ConfigureAwait(false);

            var balance = decimal.Round(total - newTotalPaid, 2, MidpointRounding.AwayFromZero);
            if (balance <= 0.01m)
            {
                const string markPaid = """
                                        UPDATE dbo.Invoices
                                        SET Status = N'Paid'
                                        WHERE InvoiceId = @InvoiceId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
                                        """;
                await conn.ExecuteAsync(
                    new CommandDefinition(markPaid,
                        new { InvoiceId = invoiceId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, tx,
                        cancellationToken: ct)).ConfigureAwait(false);
            }

            await tx.CommitAsync(ct).ConfigureAwait(false);
            return paymentId;
        }
        catch
        {
            await tx.RollbackAsync(ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task<SalesSummaryDto> GetSalesSummaryAsync(CancellationToken ct)
    {
        const string sql = """
                           SELECT
                             (
                               SELECT COUNT(*)
                               FROM dbo.Invoices i
                               WHERE i.TenantId = @TenantId AND i.OrganizationId = @OrganizationId
                                 AND i.Status IN (N'Posted', N'Paid')
                             ) AS PostedInvoiceCount,
                             (
                               SELECT ISNULL(SUM(i.TotalAmount), 0)
                               FROM dbo.Invoices i
                               WHERE i.TenantId = @TenantId AND i.OrganizationId = @OrganizationId
                                 AND i.Status IN (N'Posted', N'Paid')
                             ) AS TotalInvoicedAmount,
                             (
                               SELECT ISNULL(SUM(p.Amount), 0)
                               FROM dbo.InvoicePayments p
                               WHERE p.TenantId = @TenantId AND p.OrganizationId = @OrganizationId
                             ) AS TotalCollectedAmount,
                             (
                               SELECT ISNULL(SUM(CASE WHEN i.TotalAmount - ISNULL(pay.Paid, 0) > 0
                                 THEN i.TotalAmount - ISNULL(pay.Paid, 0) ELSE 0 END), 0)
                               FROM dbo.Invoices i
                               LEFT JOIN (
                                 SELECT InvoiceId, SUM(Amount) AS Paid
                                 FROM dbo.InvoicePayments
                                 WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
                                 GROUP BY InvoiceId
                               ) pay ON pay.InvoiceId = i.InvoiceId
                               WHERE i.TenantId = @TenantId AND i.OrganizationId = @OrganizationId
                                 AND i.Status IN (N'Posted', N'Paid')
                             ) AS TotalOutstandingAmount;
                           """;

        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var row = await conn.QuerySingleAsync<SalesSummaryRow>(
                new CommandDefinition(sql,
                    new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);

        return new SalesSummaryDto(
            row.PostedInvoiceCount,
            decimal.Round(row.TotalInvoicedAmount, 2, MidpointRounding.AwayFromZero),
            decimal.Round(row.TotalCollectedAmount, 2, MidpointRounding.AwayFromZero),
            decimal.Round(row.TotalOutstandingAmount, 2, MidpointRounding.AwayFromZero));
    }

    private sealed record SalesSummaryRow(
        int PostedInvoiceCount,
        decimal TotalInvoicedAmount,
        decimal TotalCollectedAmount,
        decimal TotalOutstandingAmount);

    private sealed record InvLockRow(long InvoiceId, decimal TotalAmount, string Status);

    private sealed record InvoiceHeadRow(
        long InvoiceId,
        string? InvoiceNumber,
        long CustomerId,
        string CustomerName,
        DateTime IssueUtc,
        string Currency,
        decimal TotalAmount,
        string Status);
}
