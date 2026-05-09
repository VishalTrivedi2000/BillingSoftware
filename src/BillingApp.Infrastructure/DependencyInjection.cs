using BillingApp.Application.Abstractions.Data;
using BillingApp.Infrastructure.Data;
using Microsoft.Extensions.DependencyInjection;

namespace BillingApp.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string sqlConnectionString)
    {
        services.AddSingleton<IDbConnectionFactory>(_ => new SqlServerConnectionFactory(sqlConnectionString));
        return services;
    }
}
