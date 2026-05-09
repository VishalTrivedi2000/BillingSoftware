namespace BillingApp.Application.Profile;

public sealed record UserProfileDto(
    long UserId,
    string Username,
    string? DisplayName,
    string? Email,
    string? Phone,
    string? JobTitle,
    string? Department,
    string? Bio,
    string? TimeZone,
    string? Locale,
    /// <summary>Absolute URL to the profile picture, or null if none.</summary>
    string? ProfilePictureUrl,
    DateTimeOffset UpdatedUtc);

public sealed record UpdateUserProfileRequest(
    string? DisplayName,
    string? Email,
    string? Phone,
    string? JobTitle,
    string? Department,
    string? Bio,
    string? TimeZone,
    string? Locale);
