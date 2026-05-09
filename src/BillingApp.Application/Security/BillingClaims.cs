namespace BillingApp.Application.Security;

/// <summary>JWT claim type constants — keep in sync with <see cref="JwtTokenIssuer"/>.</summary>
public static class BillingClaims
{
    public const string Permission = "permission";

    /// <summary>Long tenant identifier (JWT claim).</summary>
    public const string TenantId = "tenant_id";

    /// <summary>Long organization identifier (JWT claim).</summary>
    public const string OrganizationId = "org_id";
}
