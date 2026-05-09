using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class DashboardMetricsRepository : IDashboardMetricsRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public DashboardMetricsRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<DashboardMetricsDto> GetAsync(CancellationToken ct)
    {
        const string sql = """
            SELECT
              (SELECT COUNT(*) FROM dbo.Customers WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId) AS CustomerCount,
              (SELECT COUNT(*) FROM dbo.Products WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND IsActive = 1) AS ActiveProductCount,
              (SELECT COUNT(*) FROM dbo.Invoices WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId) AS InvoiceCount,
              (SELECT ISNULL(SUM(TotalAmount), 0) FROM dbo.Invoices WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId AND Status <> N'Cancelled') AS TotalInvoicedAmount;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<DashboardMetricsDto>(
            new CommandDefinition(sql,
                new { TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct)).ConfigureAwait(false);
    }
}
