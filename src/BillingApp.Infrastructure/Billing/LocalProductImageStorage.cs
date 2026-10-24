using BillingApp.Application.Abstractions.Billing;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace BillingApp.Infrastructure.Billing;

public sealed class LocalProductImageStorage : IProductImageStorage
{
    private readonly ProductImageStorageOptions _opt;
    private readonly IHostEnvironment _env;

    public LocalProductImageStorage(IOptions<ProductImageStorageOptions> opt, IHostEnvironment env)
    {
        _opt = opt.Value;
        _env = env;
    }

    private string PhysicalRoot => Path.Combine(_env.ContentRootPath, _opt.RelativeRoot.TrimStart('/', '\\'));

    public async Task<string> SaveAsync(long tenantId, long organizationId, long productId, Stream content,
        string extensionWithDot, string contentType, CancellationToken ct)
    {
        Directory.CreateDirectory(PhysicalRoot);
        var dir = Path.Combine(PhysicalRoot, tenantId.ToString(), organizationId.ToString(), productId.ToString());
        Directory.CreateDirectory(dir);

        var ext = NormalizeExtension(extensionWithDot);
        var fileName = $"{Guid.NewGuid():N}{ext}";
        var physicalPath = Path.Combine(dir, fileName);

        await using (var fs = new FileStream(physicalPath, FileMode.Create, FileAccess.Write, FileShare.None, 81984,
                       FileOptions.Asynchronous))
        {
            await content.CopyToAsync(fs, ct).ConfigureAwait(false);
        }

        return $"{tenantId}/{organizationId}/{productId}/{fileName}".Replace('\\', '/');
    }

    public Task TryDeleteAsync(string relativePath, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            return Task.CompletedTask;

        var cleaned = relativePath.Replace('\\', '/').TrimStart('/');
        var physical = Path.GetFullPath(Path.Combine(PhysicalRoot, cleaned.Replace('/', Path.DirectorySeparatorChar)));
        var root = Path.GetFullPath(PhysicalRoot);
        if (!physical.StartsWith(root, StringComparison.OrdinalIgnoreCase))
            return Task.CompletedTask;

        if (File.Exists(physical))
            File.Delete(physical);

        return Task.CompletedTask;
    }

    private static string NormalizeExtension(string extensionWithDot)
    {
        var e = extensionWithDot.Trim().ToLowerInvariant();
        if (!e.StartsWith('.'))
            e = "." + e;
        if (e is ".jpg" or ".jpeg" or ".png" or ".webp" or ".gif")
            return e;
        throw new ArgumentException("Allowed extensions: .jpg, .jpeg, .png, .webp, .gif.", nameof(extensionWithDot));
    }
}
