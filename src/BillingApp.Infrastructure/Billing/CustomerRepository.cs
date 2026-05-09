using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class CustomerRepository : ICustomerRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public CustomerRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<long> CreateAsync(CreateCustomerRequest request, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.Customers (TenantId, OrganizationId, Name, TaxId, Email, Phone)
            OUTPUT INSERTED.CustomerId
            VALUES (@TenantId, @OrganizationId, @Name, @TaxId, @Email, @Phone);
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<long>(
            new CommandDefinition(sql, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.Name,
                request.TaxId,
                request.Email,
                request.Phone,
            }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<CustomerDto>> ListAsync(int maxRows, CancellationToken ct)
    {
        const string sql = """
            SELECT TOP (@Max) CustomerId, Name, TaxId, Email, Phone, CreatedUtc
            FROM dbo.Customers
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
            ORDER BY CustomerId DESC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<CustomerDto>(
            new CommandDefinition(sql,
                new { Max = maxRows, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<CustomerDto?> GetAsync(long customerId, CancellationToken ct)
    {
        const string sql = """
            SELECT CustomerId, Name, TaxId, Email, Phone, CreatedUtc
            FROM dbo.Customers
            WHERE CustomerId = @CustomerId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<CustomerDto>(
            new CommandDefinition(sql,
                new { CustomerId = customerId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<bool> UpdateAsync(long customerId, UpdateCustomerRequest request, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.Customers SET Name = @Name, TaxId = @TaxId, Email = @Email, Phone = @Phone
            WHERE CustomerId = @CustomerId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                CustomerId = customerId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.Name,
                request.TaxId,
                request.Email,
                request.Phone,
            }, cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }
}
