using BillingApp.Application.Abstractions.Data;
using BillingApp.Application.Abstractions.Profile;
using BillingApp.Application.Profile;
using Dapper;

namespace BillingApp.Infrastructure.Profiles;

public sealed class UserProfileRepository : IUserProfileRepository
{
    private readonly IDbConnectionFactory _db;

    public UserProfileRepository(IDbConnectionFactory db) => _db = db;

    public async Task<(string Username, UserProfileRow? Row)> GetUsernameAndProfileAsync(long userId, CancellationToken ct)
    {
        const string sql = """
            SELECT u.Username AS Username,
                   p.UserId AS ProfileUserId,
                   p.DisplayName,
                   p.Email,
                   p.Phone,
                   p.JobTitle,
                   p.Department,
                   p.Bio,
                   p.TimeZone,
                   p.Locale,
                   p.ProfilePictureRelativePath,
                   p.ProfilePictureContentType,
                   p.ProfilePictureUpdatedUtc,
                   p.UpdatedUtc AS ProfileUpdatedUtc
            FROM dbo.Users u
            LEFT JOIN dbo.UserProfiles p ON p.UserId = u.UserId
            WHERE u.UserId = @UserId
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        var dto = await c.QuerySingleOrDefaultAsync<ProfileJoinDto>(
            new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct)).ConfigureAwait(false);

        if (dto?.Username is null)
            return (string.Empty, null);

        if (!dto.ProfileUserId.HasValue)
            return (dto.Username, null);

        var row = new UserProfileRow(
            dto.ProfileUserId.Value,
            dto.DisplayName,
            dto.Email,
            dto.Phone,
            dto.JobTitle,
            dto.Department,
            dto.Bio,
            dto.TimeZone,
            dto.Locale,
            dto.ProfilePictureRelativePath,
            dto.ProfilePictureContentType,
            dto.ProfilePictureUpdatedUtc,
            dto.ProfileUpdatedUtc!.Value);

        return (dto.Username, row);
    }

    public async Task UpsertProfileFieldsAsync(long userId, UpdateUserProfileRequest update, CancellationToken ct)
    {
        var (username, existing) = await GetUsernameAndProfileAsync(userId, ct).ConfigureAwait(false);
        if (string.IsNullOrEmpty(username))
            throw new InvalidOperationException("User not found.");

        static string? N(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

        string? disp = update.DisplayName is null ? existing?.DisplayName : N(update.DisplayName);
        string? email = update.Email is null ? existing?.Email : N(update.Email);
        string? phone = update.Phone is null ? existing?.Phone : N(update.Phone);
        string? job = update.JobTitle is null ? existing?.JobTitle : N(update.JobTitle);
        string? dept = update.Department is null ? existing?.Department : N(update.Department);
        string? bio = update.Bio is null ? existing?.Bio : N(update.Bio);
        string? tz = update.TimeZone is null ? existing?.TimeZone : N(update.TimeZone);
        string? locale = update.Locale is null ? existing?.Locale : N(update.Locale);

        var picPath = existing?.ProfilePictureRelativePath;
        var picCt = existing?.ProfilePictureContentType;
        var picUp = existing?.ProfilePictureUpdatedUtc;

        const string mergeSql = """
            MERGE dbo.UserProfiles AS t
            USING (SELECT @UserId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET
              DisplayName = @DisplayName,
              Email = @Email,
              Phone = @Phone,
              JobTitle = @JobTitle,
              Department = @Department,
              Bio = @Bio,
              TimeZone = @TimeZone,
              Locale = @Locale,
              UpdatedUtc = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (UserId, DisplayName, Email, Phone, JobTitle, Department, Bio, TimeZone, Locale,
              ProfilePictureRelativePath, ProfilePictureContentType, ProfilePictureUpdatedUtc)
              VALUES (@UserId, @DisplayName, @Email, @Phone, @JobTitle, @Department, @Bio, @TimeZone, @Locale,
              @PicPath, @PicCt, @PicUp);
            """;

        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(mergeSql,
            new
            {
                UserId = userId,
                DisplayName = disp,
                Email = email,
                Phone = phone,
                JobTitle = job,
                Department = dept,
                Bio = bio,
                TimeZone = tz,
                Locale = locale,
                PicPath = picPath,
                PicCt = picCt,
                PicUp = picUp,
            }, cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task UpdateProfilePictureAsync(long userId, string? relativePath, string? contentType,
        DateTime? pictureUpdatedUtc, CancellationToken ct)
    {
        const string sql = """
            MERGE dbo.UserProfiles AS t
            USING (SELECT @UserId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET
              ProfilePictureRelativePath = @Path,
              ProfilePictureContentType = @Ct,
              ProfilePictureUpdatedUtc = @PicUtc,
              UpdatedUtc = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (UserId, ProfilePictureRelativePath, ProfilePictureContentType, ProfilePictureUpdatedUtc)
              VALUES (@UserId, @Path, @Ct, @PicUtc);
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql,
            new { UserId = userId, Path = relativePath, Ct = contentType, PicUtc = pictureUpdatedUtc },
            cancellationToken: ct)).ConfigureAwait(false);
    }

    public async Task ClearProfilePictureAsync(long userId, CancellationToken ct)
    {
        const string sql = """
            UPDATE dbo.UserProfiles SET
              ProfilePictureRelativePath = NULL,
              ProfilePictureContentType = NULL,
              ProfilePictureUpdatedUtc = NULL,
              UpdatedUtc = SYSUTCDATETIME()
            WHERE UserId = @UserId
            """;
        await using var c = await _db.CreateOpenConnectionAsync(ct).ConfigureAwait(false);
        await c.ExecuteAsync(new CommandDefinition(sql, new { UserId = userId }, cancellationToken: ct)).ConfigureAwait(false);
    }

    private sealed class ProfileJoinDto
    {
        public string? Username { get; init; }
        public long? ProfileUserId { get; init; }
        public string? DisplayName { get; init; }
        public string? Email { get; init; }
        public string? Phone { get; init; }
        public string? JobTitle { get; init; }
        public string? Department { get; init; }
        public string? Bio { get; init; }
        public string? TimeZone { get; init; }
        public string? Locale { get; init; }
        public string? ProfilePictureRelativePath { get; init; }
        public string? ProfilePictureContentType { get; init; }
        public DateTime? ProfilePictureUpdatedUtc { get; init; }
        public DateTime? ProfileUpdatedUtc { get; init; }
    }
}
