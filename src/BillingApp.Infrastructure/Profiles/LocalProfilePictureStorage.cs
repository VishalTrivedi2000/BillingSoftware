using BillingApp.Application.Abstractions.Profile;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace BillingApp.Infrastructure.Profiles;

public sealed class LocalProfilePictureStorage : IProfilePictureStorage
{
    private readonly ProfileStorageOptions _opt;
    private readonly IHostEnvironment _env;

    public LocalProfilePictureStorage(IOptions<ProfileStorageOptions> opt, IHostEnvironment env)
    {
        _opt = opt.Value;
        _env = env;
    }

    private string PhysicalRoot => Path.Combine(_env.ContentRootPath, _opt.RelativeRoot.TrimStart('/', '\\'));

    public async Task<string> SaveAsync(long userId, Stream content, string extensionWithDot, string contentType,
        CancellationToken ct)
    {
        Directory.CreateDirectory(PhysicalRoot);
        var userDir = Path.Combine(PhysicalRoot, userId.ToString());
        Directory.CreateDirectory(userDir);

        var ext = NormalizeExtension(extensionWithDot);
        var fileName = $"{Guid.NewGuid():N}{ext}";
        var physicalPath = Path.Combine(userDir, fileName);

        await using (var fs = new FileStream(physicalPath, FileMode.Create, FileAccess.Write, FileShare.None, 81984,
                       FileOptions.Asynchronous))
        {
            await content.CopyToAsync(fs, ct).ConfigureAwait(false);
        }

        return $"{userId}/{fileName}".Replace('\\', '/');
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
