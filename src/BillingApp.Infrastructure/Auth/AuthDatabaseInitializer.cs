using System.Data.Common;
using BillingApp.Application.Abstractions.Auth;
using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Security;
using BillingApp.Infrastructure.Auth;
using Dapper;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BillingApp.Infrastructure.Auth;

public sealed class AuthDatabaseInitializer : IHostedService
{
    private readonly IServiceProvider _services;
    private readonly AuthBootstrapOptions _bootstrap;
    private readonly ILogger<AuthDatabaseInitializer> _logger;

    public AuthDatabaseInitializer(IServiceProvider services, AuthBootstrapOptions bootstrap, ILogger<AuthDatabaseInitializer> logger)
    {
        _services = services;
        _bootstrap = bootstrap;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = _services.CreateAsyncScope();
        var factory = scope.ServiceProvider.GetRequiredService<BillingApp.Application.Abstractions.Data.IDbConnectionFactory>();
        var repo = scope.ServiceProvider.GetRequiredService<IAuthRepository>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        await using var conn = await factory.CreateOpenConnectionAsync(cancellationToken).ConfigureAwait(false);

        var scriptPaths = new List<string>();
        if (!string.IsNullOrWhiteSpace(_bootstrap.SchemaSqlPath))
            scriptPaths.Add(_bootstrap.SchemaSqlPath);
        if (_bootstrap.AdditionalSchemaSqlPaths is not null)
            scriptPaths.AddRange(_bootstrap.AdditionalSchemaSqlPaths.Where(static p => !string.IsNullOrWhiteSpace(p)));

        foreach (var path in scriptPaths.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (!File.Exists(path))
            {
                _logger.LogError(
                    "Auth schema file missing at {Path}; migration skipped. Tenancy columns (TenantId) will be absent unless applied manually.",
                    path);
                continue;
            }

            var sql = await File.ReadAllTextAsync(path, cancellationToken).ConfigureAwait(false);
            await SqlMapper.ExecuteAsync(conn, sql).ConfigureAwait(false);
            _logger.LogInformation("Applied auth schema from {Path}", path);
        }

        await EnsureTenancySchemaAsync(conn, _logger, cancellationToken).ConfigureAwait(false);

        await SeedAsync(repo, hasher, cancellationToken).ConfigureAwait(false);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private static async Task EnsureTenancySchemaAsync(DbConnection conn, ILogger logger, CancellationToken ct)
    {
        const string sql = """
            SELECT CASE WHEN (
              OBJECT_ID(N'dbo.Organizations', N'U') IS NULL
              OR COL_LENGTH(N'dbo.Organizations', N'TenantId') IS NULL
              OR (OBJECT_ID(N'dbo.Customers', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Customers', N'TenantId') IS NULL)
              OR (OBJECT_ID(N'dbo.Customers', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Customers', N'OrganizationId') IS NULL)
              OR (OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Products', N'TenantId') IS NULL)
              OR (OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Products', N'OrganizationId') IS NULL)
              OR (OBJECT_ID(N'dbo.Invoices', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Invoices', N'TenantId') IS NULL)
              OR (OBJECT_ID(N'dbo.Invoices', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Invoices', N'OrganizationId') IS NULL)
            ) THEN 0 ELSE 1 END;
            """;

        var ok = await conn.ExecuteScalarAsync<int>(new CommandDefinition(sql, cancellationToken: ct)).ConfigureAwait(false);
        if (ok != 1)
        {
            logger.LogCritical(
                "Tenancy schema check failed: dbo.Organizations must exist with TenantId; billing tables must include TenantId + OrganizationId after migration 007.");
            throw new InvalidOperationException(
                "Database is missing tenancy columns (TenantId / OrganizationId). " +
                "Apply db/migrations/007_tenant_organization.sql to this database. " +
                "If the API was published, ensure db/migrations/*.sql is copied beside the binary (see BillingApp.Api.csproj).");
        }
    }

    private static async Task SeedAsync(IAuthRepository repo, IPasswordHasher hasher, CancellationToken ct)
    {
        foreach (var p in PermissionNames.All)
            await repo.EnsurePermissionAsync(p, ct).ConfigureAwait(false);

        await repo.EnsureRoleAsync(RoleNames.Admin, "Full configuration & reports", ct).ConfigureAwait(false);
        await repo.EnsureRoleAsync(RoleNames.BillingStaff, "Invoices & customers", ct).ConfigureAwait(false);
        await repo.EnsureRoleAsync(RoleNames.Accountant, "Read-only financial views", ct).ConfigureAwait(false);

        async Task LinkRolePerms(string roleName, IEnumerable<string> permissionNames)
        {
            var rid = await repo.GetRoleIdByNameAsync(roleName, ct).ConfigureAwait(false);
            if (!rid.HasValue) return;
            foreach (var pn in permissionNames)
            {
                var pid = await repo.GetPermissionIdByNameAsync(pn, ct).ConfigureAwait(false);
                if (pid.HasValue)
                    await repo.EnsureRolePermissionAsync(rid.Value, pid.Value, ct).ConfigureAwait(false);
            }
        }

        await LinkRolePerms(RoleNames.Admin, PermissionNames.All).ConfigureAwait(false);

        await LinkRolePerms(RoleNames.BillingStaff, new[]
        {
            PermissionNames.SystemHealth,
            PermissionNames.InvoicesCreate, PermissionNames.InvoicesRead, PermissionNames.InvoicesUpdate,
            PermissionNames.CustomersRead, PermissionNames.CustomersCreate, PermissionNames.CustomersUpdate,
            PermissionNames.ProductsRead, PermissionNames.ProductsManage,
            PermissionNames.OrganizationsRead,
            PermissionNames.OrganizationsManage,
        }).ConfigureAwait(false);

        await LinkRolePerms(RoleNames.Accountant, new[]
        {
            PermissionNames.SystemHealth,
            PermissionNames.InvoicesRead,
            PermissionNames.ReportsRead,
            PermissionNames.CustomersRead,
            PermissionNames.ProductsRead,
            PermissionNames.OrganizationsRead,
        }).ConfigureAwait(false);

        async Task EnsureUser(string username, string password, string roleName)
        {
            var existing = await repo.GetUserByUsernameAsync(username, ct).ConfigureAwait(false);
            if (existing is null)
            {
                var uid = await repo.InsertUserAsync(username, hasher.HashPassword(password), ct, developerPlaintextPassword: password)
                    .ConfigureAwait(false);
                var rid = await repo.GetRoleIdByNameAsync(roleName, ct).ConfigureAwait(false);
                if (rid.HasValue)
                    await repo.AssignUserRoleAsync(uid, rid.Value, ct).ConfigureAwait(false);
            }
            else
            {
                await repo.SetDeveloperPlaintextPasswordAsync(username, password, ct).ConfigureAwait(false);
            }
        }

        await EnsureUser("admin", "Admin@123", RoleNames.Admin).ConfigureAwait(false);
        await EnsureUser("billing", "Billing@123", RoleNames.BillingStaff).ConfigureAwait(false);
        await EnsureUser("accountant", "Account@123", RoleNames.Accountant).ConfigureAwait(false);

        await LinkSeedUsersToDefaultOrganizationAsync(repo, ct).ConfigureAwait(false);
    }

    private static async Task LinkSeedUsersToDefaultOrganizationAsync(IAuthRepository repo, CancellationToken ct)
    {
        foreach (var username in new[] { "admin", "billing", "accountant" })
        {
            var row = await repo.GetUserByUsernameAsync(username, ct).ConfigureAwait(false);
            if (row is not null)
                await repo.EnsureUserOrganizationAsync(row.UserId, organizationId: 1, setAsDefault: true, ct).ConfigureAwait(false);
        }
    }
}
