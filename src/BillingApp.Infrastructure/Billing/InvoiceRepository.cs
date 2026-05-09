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
                VALUES (@InvoiceId, @ProductId, @Description, @Quantity, @UnitPrice, @LineTotal);
                """;

            foreach (var line in request.Lines)
            {
                var lineTotal = decimal.Round(line.Quantity * line.UnitPrice, 2, MidpointRounding.AwayFromZero);
                total += lineTotal;
                await conn.ExecuteAsync(new CommandDefinition(insertLine, new
                {
                    InvoiceId = invoiceId,
                    ProductId = line.ProductId,
                    Description = line.Description.Trim(),
                    Quantity = line.Quantity,
                    UnitPrice = line.UnitPrice,
                    LineTotal = lineTotal,
                }, tx, cancellationToken: ct)).ConfigureAwait(false);
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

    public async Task<IReadOnlyList<InvoiceSummaryDto>> ListAsync(int skip, int take, CancellationToken ct)
    {
        const string sql = """
            SELECT i.InvoiceId, i.InvoiceNumber, i.CustomerId, c.Name AS CustomerName, i.IssueUtc, i.TotalAmount, i.Status
            FROM dbo.Invoices i
            INNER JOIN dbo.Customers c ON c.CustomerId = i.CustomerId AND c.TenantId = i.TenantId AND c.OrganizationId = i.OrganizationId
            WHERE i.TenantId = @TenantId AND i.OrganizationId = @OrganizationId
            ORDER BY i.InvoiceId DESC
            OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<InvoiceSummaryDto>(
            new CommandDefinition(sql,
                new { Skip = skip, Take = take, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId },
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

        return new InvoiceDetailDto(
            head.InvoiceId,
            head.InvoiceNumber,
            head.CustomerId,
            head.CustomerName,
            head.IssueUtc,
            head.Currency,
            head.TotalAmount,
            head.Status,
            lines.AsList());
    }

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
