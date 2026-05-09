using BillingApp.Application.Abstractions.Profile;
using BillingApp.Application.Profile;
using BillingApp.Infrastructure.Profiles;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/profile")]
public sealed class ProfileController : ControllerBase
{
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif",
    };

    private readonly IUserProfileRepository _profiles;
    private readonly IProfilePictureStorage _pictures;
    private readonly ProfileStorageOptions _storageOpt;

    public ProfileController(
        IUserProfileRepository profiles,
        IProfilePictureStorage pictures,
        IOptions<ProfileStorageOptions> storageOpt)
    {
        _profiles = profiles;
        _pictures = pictures;
        _storageOpt = storageOpt.Value;
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserProfileDto>> GetMine(CancellationToken ct)
    {
        var userId = RequireUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var dto = await BuildDtoAsync(userId.Value, ct).ConfigureAwait(false);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPatch("me")]
    public async Task<ActionResult<UserProfileDto>> PatchMine([FromBody] UpdateUserProfileRequest body, CancellationToken ct)
    {
        var userId = RequireUserId();
        if (!userId.HasValue)
            return Unauthorized();

        try
        {
            await _profiles.UpsertProfileFieldsAsync(userId.Value, body, ct).ConfigureAwait(false);
        }
        catch (InvalidOperationException)
        {
            return NotFound();
        }

        var dto = await BuildDtoAsync(userId.Value, ct).ConfigureAwait(false);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("me/picture")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<ActionResult<UserProfileDto>> UploadPicture(IFormFile file, CancellationToken ct)
    {
        var userId = RequireUserId();
        if (!userId.HasValue)
            return Unauthorized();

        if (file is null || file.Length == 0)
            return BadRequest("No file uploaded.");

        if (file.Length > _storageOpt.MaxPictureBytes)
            return BadRequest($"File exceeds {_storageOpt.MaxPictureBytes} bytes.");

        var ctVal = file.ContentType ?? string.Empty;
        if (!AllowedContentTypes.Contains(ctVal))
            return BadRequest("Only JPEG, PNG, WebP, or GIF images are allowed.");

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext))
        {
            ext = ctVal switch
            {
                "image/jpeg" => ".jpg",
                "image/png" => ".png",
                "image/webp" => ".webp",
                "image/gif" => ".gif",
                _ => string.Empty,
            };
        }

        if (string.IsNullOrEmpty(ext))
            return BadRequest("Could not determine file extension.");

        var (_, existing) = await _profiles.GetUsernameAndProfileAsync(userId.Value, ct).ConfigureAwait(false);
        var oldPath = existing?.ProfilePictureRelativePath;
        if (!string.IsNullOrEmpty(oldPath))
            await _pictures.TryDeleteAsync(oldPath, ct).ConfigureAwait(false);

        string relative;
        try
        {
            await using var stream = file.OpenReadStream();
            relative = await _pictures.SaveAsync(userId.Value, stream, ext, ctVal, ct).ConfigureAwait(false);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }

        var picUtc = DateTime.UtcNow;
        await _profiles.UpdateProfilePictureAsync(userId.Value, relative, ctVal, picUtc, ct).ConfigureAwait(false);

        var dto = await BuildDtoAsync(userId.Value, ct).ConfigureAwait(false);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpDelete("me/picture")]
    public async Task<ActionResult<UserProfileDto>> DeletePicture(CancellationToken ct)
    {
        var userId = RequireUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var (_, existing) = await _profiles.GetUsernameAndProfileAsync(userId.Value, ct).ConfigureAwait(false);
        var oldPath = existing?.ProfilePictureRelativePath;
        if (!string.IsNullOrEmpty(oldPath))
            await _pictures.TryDeleteAsync(oldPath, ct).ConfigureAwait(false);

        await _profiles.ClearProfilePictureAsync(userId.Value, ct).ConfigureAwait(false);

        var dto = await BuildDtoAsync(userId.Value, ct).ConfigureAwait(false);
        return dto is null ? NotFound() : Ok(dto);
    }

    private long? RequireUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return long.TryParse(sub, out var id) ? id : null;
    }

    private async Task<UserProfileDto?> BuildDtoAsync(long userId, CancellationToken ct)
    {
        var (username, row) = await _profiles.GetUsernameAndProfileAsync(userId, ct).ConfigureAwait(false);
        if (string.IsNullOrEmpty(username))
            return null;

        string? picUrl = null;
        if (!string.IsNullOrEmpty(row?.ProfilePictureRelativePath))
        {
            var basePath = _storageOpt.PublicRequestPath.TrimEnd('/');
            var rel = row.ProfilePictureRelativePath.Replace('\\', '/').TrimStart('/');
            var v = row.ProfilePictureUpdatedUtc.HasValue
                ? new DateTimeOffset(DateTime.SpecifyKind(row.ProfilePictureUpdatedUtc.Value, DateTimeKind.Utc)).ToUnixTimeSeconds()
                : 0;
            picUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}{basePath}/{rel}?v={v}";
        }

        var updated = row?.UpdatedUtc ?? DateTime.UtcNow;

        return new UserProfileDto(
            userId,
            username,
            row?.DisplayName,
            row?.Email,
            row?.Phone,
            row?.JobTitle,
            row?.Department,
            row?.Bio,
            row?.TimeZone,
            row?.Locale,
            picUrl,
            new DateTimeOffset(DateTime.SpecifyKind(updated, DateTimeKind.Utc)));
    }
}
