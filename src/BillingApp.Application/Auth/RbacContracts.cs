using System.Text.Json.Serialization;

namespace BillingApp.Application.Auth;

/// <summary>LockSystem-shaped RBAC payloads (camelCase JSON, string ids).</summary>
public sealed record SetRolePermissionsRequest(IReadOnlyList<string> PermissionIds);

public sealed record RbacPermissionCatalogEntryDto(
    [property: JsonPropertyName("id")] string Id,
    string Name,
    string DisplayName,
    string? Description,
    string Category);

public sealed record RbacRoleSummaryDto(
    [property: JsonPropertyName("id")] string Id,
    string Name,
    string DisplayName,
    string? Description,
    string ScopeLevel,
    int PermissionCount,
    long UserCount);

public sealed record RbacRoleDetailDto(
    [property: JsonPropertyName("id")] string Id,
    string Name,
    string DisplayName,
    string? Description,
    string ScopeLevel,
    IReadOnlyList<string> PermissionIds);
