using BillingApp.Api;
using BillingApp.Infrastructure;
using BillingApp.Infrastructure.Auth;
using BillingApp.Infrastructure.Billing;
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
    ?? "Data Source=DESKTOP-4TKGMET;Initial Catalog=BSDB;Integrated Security=True;Trust Server Certificate=True";
builder.Services.AddInfrastructure(connectionString);
builder.Services.AddBillingCore();
builder.Services.AddInventoryModule();
builder.Services.AddBillingProfiles(builder.Configuration);
builder.Services.AddProductImages(builder.Configuration);

var profileMaxBytes = builder.Configuration.GetValue<long?>("ProfileStorage:MaxPictureBytes") ?? 5 * 1024 * 1024;
var productImgMaxBytes = builder.Configuration.GetValue<long?>("ProductImages:MaxPictureBytes") ?? profileMaxBytes;
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = Math.Max(profileMaxBytes, productImgMaxBytes);
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
        Path.Combine(migrationsDir, "008_parties.sql"),
        Path.Combine(migrationsDir, "009_product_inventory_catalog.sql"),
        Path.Combine(migrationsDir, "010_product_images.sql"),
        Path.Combine(migrationsDir, "011_product_taxonomy.sql"),
        Path.Combine(migrationsDir, "012_invoice_payments.sql"),
        Path.Combine(migrationsDir, "013_purchase_bills.sql"),
        Path.Combine(migrationsDir, "014_product_inventory_extended.sql"),
        Path.Combine(migrationsDir, "015_purchase_line_tax_discount.sql"),
        Path.Combine(migrationsDir, "016_universal_inventory_foundation.sql"),
        Path.Combine(migrationsDir, "017_universal_inventory_backfill.sql"),
        Path.Combine(migrationsDir, "018_universal_inventory_extras.sql"),
        Path.Combine(migrationsDir, "019_fix_inventory_unique_index_scope.sql"),
        Path.Combine(migrationsDir, "020_product_catalog_extended_fields.sql"),
    },
});

builder.Services.AddBillingAuth(builder.Configuration);
builder.Services.AddBillingJwtAndAuthorizationPolicies(builder.Configuration, builder.Environment);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("web");
app.UseHttpsRedirection();

var profileOpts = app.Configuration.GetSection(ProfileStorageOptions.SectionName).Get<ProfileStorageOptions>()
                  ?? new ProfileStorageOptions();
var profilePhysicalRoot = Path.Combine(app.Environment.ContentRootPath, profileOpts.RelativeRoot.TrimStart('/', '\\'));
Directory.CreateDirectory(profilePhysicalRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(profilePhysicalRoot),
    RequestPath = profileOpts.PublicRequestPath,
});

var productImgOpts = app.Configuration.GetSection(ProductImageStorageOptions.SectionName).Get<ProductImageStorageOptions>()
                     ?? new ProductImageStorageOptions();
var productPhysicalRoot = Path.Combine(app.Environment.ContentRootPath, productImgOpts.RelativeRoot.TrimStart('/', '\\'));
Directory.CreateDirectory(productPhysicalRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(productPhysicalRoot),
    RequestPath = productImgOpts.PublicRequestPath,
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
