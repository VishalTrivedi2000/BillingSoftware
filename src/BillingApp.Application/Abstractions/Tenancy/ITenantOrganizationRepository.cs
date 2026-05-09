using BillingApp.Application.Tenancy;

namespace BillingApp.Application.Abstractions.Tenancy;

public interface ITenantOrganizationRepository
{
    Task<TenantDto?> GetTenantAsync(long tenantId, CancellationToken ct);

    Task<IReadOnlyList<TenantDto>> ListTenantsAsync(CancellationToken ct);

    Task<bool> TenantSlugTakenAsync(string slug, CancellationToken ct);

    Task<long> InsertTenantAsync(string slug, string name, CancellationToken ct);

    Task<IReadOnlyList<OrganizationDto>> ListOrganizationsByTenantAsync(long tenantId, CancellationToken ct);

    Task<OrganizationDto?> GetOrganizationAsync(long organizationId, long tenantId, CancellationToken ct);

    Task<bool> OrganizationCodeTakenAsync(long tenantId, string code, long? exceptOrganizationId, CancellationToken ct);

    Task<long> InsertOrganizationAsync(long tenantId, string code, string name, CancellationToken ct);

    Task<bool> UpdateOrganizationAsync(long organizationId, long tenantId, string code, string name, bool isActive, CancellationToken ct);

    Task<IReadOnlyList<OrganizationMembershipDto>> ListMembershipsForUserAsync(long userId, CancellationToken ct);
}
