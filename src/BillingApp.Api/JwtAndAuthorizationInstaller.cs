using System.Security.Claims;
using System.Text;
using BillingApp.Api.Authorization;
using BillingApp.Application.Security;
using BillingApp.Infrastructure.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;

namespace BillingApp.Api;

public static class JwtAndAuthorizationInstaller
{
    public static IServiceCollection AddBillingJwtAndAuthorizationPolicies(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSection = configuration.GetSection(JwtOptions.SectionName);
        var jwt = jwtSection.Get<JwtOptions>()
                  ?? throw new InvalidOperationException($"Configure {JwtOptions.SectionName} in appsettings.");

        if (string.IsNullOrWhiteSpace(jwt.SigningKey) || jwt.SigningKey.Length < 32)
            throw new InvalidOperationException("Jwt:SigningKey must be at least 32 characters.");

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
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
                    RoleClaimType = System.Security.Claims.ClaimTypes.Role,
                };
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
                           || HasPermission(u, PermissionNames.InvoicesCreate);
                });
            });
        });

        services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();

        services.AddCors(o =>
        {
            o.AddPolicy("web", b =>
            {
                b.WithOrigins(
                        "http://localhost:5173",
                        "https://localhost:5173")
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        return services;
    }
}
