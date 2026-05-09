namespace BillingApp.Application.Abstractions.Profile;

public interface IProfilePictureStorage
{
    /// <summary>Writes picture bytes and returns path segment relative to <see cref="ProfileStorageOptions.PublicRequestPath"/> root.</summary>
    Task<string> SaveAsync(long userId, Stream content, string extensionWithDot, string contentType, CancellationToken ct);

    Task TryDeleteAsync(string relativePath, CancellationToken ct);
}
