using BillingApp.Application.Abstractions.Auth;
using BillingApp.Infrastructure.Auth;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BillingApp.Infrastructure;

public static class BillingAuthDependencyInjection
{
    public static IServiceCollection AddBillingAuth(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddScoped<IAuthRepository, AuthRepository>();
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddSingleton<IJwtTokenIssuer, JwtTokenIssuer>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddHostedService<AuthDatabaseInitializer>();
        return services;
    }
}
