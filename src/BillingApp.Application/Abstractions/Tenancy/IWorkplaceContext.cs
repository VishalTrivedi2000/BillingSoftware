namespace BillingApp.Application.Abstractions.Tenancy;

/// <summary>Current tenant + organization from the authenticated JWT (request scope).</summary>
public interface IWorkplaceContext
{
    long TenantId { get; }
    long OrganizationId { get; }
}
