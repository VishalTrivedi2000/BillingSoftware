namespace BillingApp.Application.Abstractions.Billing;

public interface IProductImageStorage
{
    /// <summary>Writes image under tenant/org/product folder; returns path segments relative to the configured product uploads folder.</summary>
    Task<string> SaveAsync(long tenantId, long organizationId, long productId, Stream content, string extensionWithDot,
        string contentType, CancellationToken ct);

    Task TryDeleteAsync(string relativePath, CancellationToken ct);
}
