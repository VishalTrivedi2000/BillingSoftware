using System.Security.Claims;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Http;

namespace BillingApp.Api;

/// <summary>Resolves tenant and organization from JWT claims issued at login/refresh.</summary>
public sealed class WorkplaceContext : IWorkplaceContext
{
    private readonly IHttpContextAccessor _http;

    public WorkplaceContext(IHttpContextAccessor http) => _http = http;

    public long TenantId => ParseRequired(BillingClaims.TenantId);

    public long OrganizationId => ParseRequired(BillingClaims.OrganizationId);

    private long ParseRequired(string claimType)
    {
        var raw = _http.HttpContext?.User?.FindFirstValue(claimType);
        if (long.TryParse(raw, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var id))
            return id;
        throw new InvalidOperationException($"Missing or invalid JWT claim '{claimType}'.");
    }
}
