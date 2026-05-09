using BillingApp.Api;
using BillingApp.Infrastructure;
using BillingApp.Infrastructure.Auth;
using BillingApp.Infrastructure.Profiles;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new() { Title = "Billing API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = JwtBearerDefaults.AuthenticationScheme,
        BearerFormat = "JWT",
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer",
                },
            },
            Array.Empty<string>()
        },
    });
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=(localdb)\\mssqllocaldb;Database=BillingApp;Trusted_Connection=True;TrustServerCertificate=true;";
builder.Services.AddInfrastructure(connectionString);
builder.Services.AddBillingCore();

builder.Services.Configure<FormOptions>(options =>
{
    var max = builder.Configuration.GetValue<long?>("ProfileStorage:MaxPictureBytes") ?? 5 * 1024 * 1024;
    options.MultipartBodyLengthLimit = max;
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<BillingApp.Application.Abstractions.Tenancy.IWorkplaceContext, WorkplaceContext>();

static string ResolveMigrationsDirectory(IHostEnvironment env)
{
    var besideBinary = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "db", "migrations"));
    if (Directory.Exists(besideBinary))
        return besideBinary;

    var fromRepoRoot = Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "db", "migrations"));
    return fromRepoRoot;
}

var migrationsDir = ResolveMigrationsDirectory(builder.Environment);
builder.Services.AddSingleton(new AuthBootstrapOptions
{
    SchemaSqlPath = Path.Combine(migrationsDir, "001_auth.sql"),
    AdditionalSchemaSqlPaths = new[]
    {
        Path.Combine(migrationsDir, "002_user_permission_grants.sql"),
        Path.Combine(migrationsDir, "003_user_role_grants.sql"),
        Path.Combine(migrationsDir, "004_user_profiles.sql"),
        Path.Combine(migrationsDir, "005_users_developer_plaintext_password.sql"),
        Path.Combine(migrationsDir, "006_billing_core.sql"),
        Path.Combine(migrationsDir, "007_tenant_organization.sql"),
    },
});

builder.Services.AddBillingAuth(builder.Configuration);
builder.Services.AddBillingJwtAndAuthorizationPolicies(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("web");

var profileOpts = app.Configuration.GetSection(ProfileStorageOptions.SectionName).Get<ProfileStorageOptions>()
                  ?? new ProfileStorageOptions();
var profilePhysicalRoot = Path.Combine(app.Environment.ContentRootPath, profileOpts.RelativeRoot.TrimStart('/', '\\'));
Directory.CreateDirectory(profilePhysicalRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(profilePhysicalRoot),
    RequestPath = profileOpts.PublicRequestPath,
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
