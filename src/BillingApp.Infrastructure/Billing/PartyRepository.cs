using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Billing;
using Dapper;

namespace BillingApp.Infrastructure.Billing;

public sealed class PartyRepository : IPartyRepository
{
    private readonly IDbConnectionFactory _db;
    private readonly IWorkplaceContext _wp;

    public PartyRepository(IDbConnectionFactory db, IWorkplaceContext wp)
    {
        _db = db;
        _wp = wp;
    }

    public async Task<long> CreateAsync(CreatePartyRequest request, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO dbo.Parties (TenantId, OrganizationId, Kind, DisplayName, LegalName, TaxId, Email, Phone, Notes)
            OUTPUT INSERTED.PartyId
            VALUES (@TenantId, @OrganizationId, @Kind, @DisplayName, @LegalName, @TaxId, @Email, @Phone, @Notes);
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleAsync<long>(
            new CommandDefinition(sql, new
            {
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.Kind,
                request.DisplayName,
                LegalName = request.LegalName,
                TaxId = request.TaxId,
                Email = request.Email,
                Phone = request.Phone,
                Notes = request.Notes,
            }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<PartyDto>> ListAsync(int maxRows, CancellationToken ct)
    {
        const string sql = """
            SELECT TOP (@Max) PartyId, Kind, DisplayName, LegalName, TaxId, Email, Phone, Notes, IsActive, CreatedUtc
            FROM dbo.Parties
            WHERE TenantId = @TenantId AND OrganizationId = @OrganizationId
            ORDER BY PartyId DESC;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var rows = await conn.QueryAsync<PartyDto>(
            new CommandDefinition(sql,
                new { Max = maxRows, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
        return rows.AsList();
    }

    public async Task<PartyDto?> GetAsync(long partyId, CancellationToken ct)
    {
        const string sql = """
            SELECT PartyId, Kind, DisplayName, LegalName, TaxId, Email, Phone, Notes, IsActive, CreatedUtc
            FROM dbo.Parties
            WHERE PartyId = @PartyId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        return await conn.QuerySingleOrDefaultAsync<PartyDto>(
            new CommandDefinition(sql,
                new { PartyId = partyId, TenantId = _wp.TenantId, OrganizationId = _wp.OrganizationId }, cancellationToken: ct))
            .ConfigureAwait(false);
    }

    public async Task<bool> UpdateAsync(long partyId, UpdatePartyRequest request, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.Parties
            SET Kind = @Kind, DisplayName = @DisplayName, LegalName = @LegalName, TaxId = @TaxId,
                Email = @Email, Phone = @Phone, Notes = @Notes, IsActive = @IsActive
            WHERE PartyId = @PartyId AND TenantId = @TenantId AND OrganizationId = @OrganizationId;
            """;
        await using var conn = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var n = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                PartyId = partyId,
                TenantId = _wp.TenantId,
                OrganizationId = _wp.OrganizationId,
                request.Kind,
                request.DisplayName,
                LegalName = request.LegalName,
                TaxId = request.TaxId,
                Email = request.Email,
                Phone = request.Phone,
                Notes = request.Notes,
                request.IsActive,
            }, cancellationToken: ct)).ConfigureAwait(false);
        return n > 0;
    }
}
