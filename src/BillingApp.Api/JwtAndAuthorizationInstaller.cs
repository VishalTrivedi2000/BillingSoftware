using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BillingApp.Api.Authorization;
using BillingApp.Application.Security;
using BillingApp.Infrastructure.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace BillingApp.Api;

public static class JwtAndAuthorizationInstaller
{
    public static IServiceCollection AddBillingJwtAndAuthorizationPolicies(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var jwtSection = configuration.GetSection(JwtOptions.SectionName);
        var jwt = jwtSection.Get<JwtOptions>()
                  ?? throw new InvalidOperationException($"Configure {JwtOptions.SectionName} in appsettings.");

        if (string.IsNullOrWhiteSpace(jwt.SigningKey) || jwt.SigningKey.Length < 32)
            throw new InvalidOperationException("Jwt:SigningKey must be at least 32 characters.");

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                // Keep short JWT names from JwtSecurityTokenHandler (sub, role, tenant_id, org_id, permission).
                options.MapInboundClaims = false;

                if (environment.IsDevelopment())
                    options.RequireHttpsMetadata = false;

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = jwt.Issuer,
                    ValidAudience = jwt.Audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                    ClockSkew = TimeSpan.FromMinutes(2),
                    NameClaimType = JwtRegisteredClaimNames.Sub,
                    RoleClaimType = "role",
                };

                if (environment.IsDevelopment())
                {
                    options.Events = new JwtBearerEvents
                    {
                        OnAuthenticationFailed = context =>
                        {
                            var logger = context.HttpContext.RequestServices.GetService<ILoggerFactory>()
                                ?.CreateLogger("JwtBearerAuthentication");
                            logger?.LogWarning(
                                context.Exception,
                                "JWT rejected — issuer/audience/key mismatch, expired token, or malformed Authorization header. Message: {Msg}",
                                context.Exception?.Message ?? "(null)");
                            return Task.CompletedTask;
                        },
                    };
                }
            });

        services.AddAuthorization(options =>
        {
            foreach (var p in PermissionNames.All)
            {
                options.AddPolicy(PolicyNames.Permission(p),
                    policy => policy.Requirements.Add(new PermissionRequirement(p)));
            }

            options.AddPolicy(PolicyNames.BuiltIn.CatalogRead, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireAssertion(ctx =>
                {
                    if (ctx.User.IsInRole(RoleNames.Admin))
                        return true;

                    static bool HasPermission(ClaimsPrincipal user, string permission) =>
                        user.FindAll(BillingClaims.Permission).Any(c =>
                            string.Equals(c.Value, permission, StringComparison.Ordinal));

                    var u = ctx.User;
                    return HasPermission(u, PermissionNames.ProductsRead)
                           || HasPermission(u, PermissionNames.InvoicesRead)
                           || HasPermission(u, PermissionNames.InvoicesCreate)
                           || HasPermission(u, PermissionNames.InventoryView);
                });
            });

            // Inventory umbrella: any inventory-touching permission grants ledger/balance read.
            options.AddPolicy(PolicyNames.BuiltIn.InventoryRead, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireAssertion(ctx =>
                {
                    if (ctx.User.IsInRole(RoleNames.Admin))
                        return true;

                    static bool HasPermission(ClaimsPrincipal user, string permission) =>
                        user.FindAll(BillingClaims.Permission).Any(c =>
                            string.Equals(c.Value, permission, StringComparison.Ordinal));

                    var u = ctx.User;
                    return HasPermission(u, PermissionNames.InventoryView)
                           || HasPermission(u, PermissionNames.InventoryAdjust)
                           || HasPermission(u, PermissionNames.InventoryTransfer)
                           || HasPermission(u, PermissionNames.InventoryReserve)
                           || HasPermission(u, PermissionNames.InventoryReturn)
                           || HasPermission(u, PermissionNames.ReportsInventory);
                });
            });
        });

        services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();

        services.AddCors(o =>
        {
            o.AddPolicy("web", b =>
            {
                if (environment.IsDevelopment())
                {
                    b.SetIsOriginAllowed(static origin =>
                    {
                        try
                        {
                            var uri = new Uri(origin);
                            return uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                                   || uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);
                        }
                        catch
                        {
                            return false;
                        }
                    })
                        .AllowAnyHeader()
                        .AllowAnyMethod();
                }
                else
                {
                    b.WithOrigins(
                        "http://localhost:5173",
                        "https://localhost:5173",
                        "http://127.0.0.1:5173",
                        "https://127.0.0.1:5173")
                        .AllowAnyHeader()
                        .AllowAnyMethod();
                }
            });
        });

        return services;
    }
}
