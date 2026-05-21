using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Infrastructure.Inventory;
using Microsoft.Extensions.DependencyInjection;

namespace BillingApp.Infrastructure;

public static class InventoryDependencyInjection
{
    public static IServiceCollection AddInventoryModule(this IServiceCollection services)
    {
        services.AddScoped<IWarehouseRepository, WarehouseRepository>();
        services.AddScoped<IProductVariantRepository, ProductVariantRepository>();
        services.AddScoped<IInventoryRepository, InventoryLedgerRepository>();
        services.AddScoped<IInventoryReservationRepository, InventoryReservationRepository>();
        services.AddScoped<IStockTransferRepository, StockTransferRepository>();
        services.AddScoped<IBatchRepository, BatchRepository>();
        services.AddScoped<IProductSerialRepository, ProductSerialRepository>();
        services.AddScoped<IReturnRepository, ReturnRepository>();
        services.AddScoped<IInventoryReportRepository, InventoryReportRepository>();
        return services;
    }
}
