using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Infrastructure.Billing;
using BillingApp.Infrastructure.Tenancy;
using Microsoft.Extensions.DependencyInjection;

namespace BillingApp.Infrastructure;

public static class BillingCoreDependencyInjection
{
    public static IServiceCollection AddBillingCore(this IServiceCollection services)
    {
        services.AddScoped<ITenantOrganizationRepository, TenantOrganizationRepository>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IInvoiceRepository, InvoiceRepository>();
        services.AddScoped<IDashboardMetricsRepository, DashboardMetricsRepository>();
        return services;
    }
}
