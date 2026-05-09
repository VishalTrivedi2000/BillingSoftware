namespace BillingApp.Infrastructure.Profiles;

public sealed class ProfileStorageOptions
{
    public const string SectionName = "ProfileStorage";

    /// <summary>Under content root, e.g. <c>uploads/profiles</c>.</summary>
    public string RelativeRoot { get; init; } = "uploads/profiles";

    public string PublicRequestPath { get; init; } = "/uploads/profiles";

    public long MaxPictureBytes { get; init; } = 5 * 1024 * 1024;
}
