using BillingApp.Application.Abstractions.Profile;
using BillingApp.Infrastructure.Profiles;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BillingApp.Infrastructure;

public static class BillingProfileDependencyInjection
{
    public static IServiceCollection AddBillingProfiles(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ProfileStorageOptions>(configuration.GetSection(ProfileStorageOptions.SectionName));
        services.AddScoped<IUserProfileRepository, UserProfileRepository>();
        services.AddSingleton<IProfilePictureStorage, LocalProfilePictureStorage>();
        return services;
    }
}
