namespace BillingApp.Infrastructure.Auth;

/// <summary>SQL scripts executed on startup (base schema + optional incremental migrations).</summary>
public sealed class AuthBootstrapOptions
{
    /// <summary>Primary DDL (e.g. db/migrations/001_auth.sql).</summary>
    public string SchemaSqlPath { get; init; } = "";

    /// <summary>Additional scripts applied after <see cref="SchemaSqlPath"/> (e.g. 002_user_permission_grants.sql).</summary>
    public IReadOnlyList<string> AdditionalSchemaSqlPaths { get; init; } = Array.Empty<string>();
}
