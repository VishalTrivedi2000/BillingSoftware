using System.Security.Claims;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;

namespace BillingApp.Api.Authorization;

public sealed class PermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }

    public PermissionRequirement(string permission) => Permission = permission;
}

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.User.IsInRole(RoleNames.Admin))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var ok = context.User.FindAll(BillingClaims.Permission).Any(c =>
            string.Equals(c.Value, requirement.Permission, StringComparison.Ordinal));

        if (ok)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}

public static class PolicyNames
{
    public static string Permission(string p) => $"perm:{p}";

    /// <summary>Policy names usable on attributes (<see cref="AuthorizeAttribute.Policy"/> requires compile-time constants).</summary>
    public static class BuiltIn
    {
        public const string SystemHealth = "perm:" + PermissionNames.SystemHealth;
        public const string DelegationsManage = "perm:" + PermissionNames.DelegationsManage;
        public const string UsersManage = "perm:" + PermissionNames.UsersManage;

        public const string RolesRead = "perm:" + PermissionNames.RolesRead;
        public const string RolesManage = "perm:" + PermissionNames.RolesManage;

        /// <summary>Read product catalog: explicit <see cref="PermissionNames.ProductsRead"/> or invoice read/create (line-item workflow).</summary>
        public const string CatalogRead = "catalog:read";
    }
}
