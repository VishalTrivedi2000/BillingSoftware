using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Abstractions.Tenancy;
using BillingApp.Infrastructure.Billing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BillingApp.Infrastructure;

public static class ProductImagesDependencyInjection
{
    public static IServiceCollection AddProductImages(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ProductImageStorageOptions>(configuration.GetSection(ProductImageStorageOptions.SectionName));
        services.AddSingleton<IProductImageStorage, LocalProductImageStorage>();
        services.AddScoped<IProductImageRepository, ProductImageRepository>();
        return services;
    }
}
