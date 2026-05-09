namespace BillingApp.Application.Tenancy;

public sealed record TenantDto(long TenantId, string Slug, string Name, bool IsActive, DateTime CreatedUtc);

public sealed record OrganizationDto(long OrganizationId, long TenantId, string Code, string Name, bool IsActive, DateTime CreatedUtc);

public sealed record OrganizationMembershipDto(long TenantId, long OrganizationId, string OrganizationCode, string OrganizationName, bool IsDefault);

public sealed record CreateTenantRequest(string Slug, string Name);

public sealed record CreateOrganizationRequest(string Code, string Name);

public sealed record UpdateOrganizationRequest(string Code, string Name, bool IsActive);

public sealed record AssignOrganizationMemberRequest(long UserId, bool SetAsDefault);
