using BillingApp.Application.Profile;

namespace BillingApp.Application.Abstractions.Profile;

public interface IUserProfileRepository
{
    Task<(string Username, UserProfileRow? Row)> GetUsernameAndProfileAsync(long userId, CancellationToken ct);

    Task UpsertProfileFieldsAsync(long userId, UpdateUserProfileRequest update, CancellationToken ct);

    Task UpdateProfilePictureAsync(long userId, string? relativePath, string? contentType, DateTime? pictureUpdatedUtc,
        CancellationToken ct);

    Task ClearProfilePictureAsync(long userId, CancellationToken ct);
}

/// <summary>Raw row — compose <see cref="UserProfileDto"/> in application/service layer.</summary>
public sealed record UserProfileRow(
    long UserId,
    string? DisplayName,
    string? Email,
    string? Phone,
    string? JobTitle,
    string? Department,
    string? Bio,
    string? TimeZone,
    string? Locale,
    string? ProfilePictureRelativePath,
    string? ProfilePictureContentType,
    DateTime? ProfilePictureUpdatedUtc,
    DateTime UpdatedUtc);
