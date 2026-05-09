namespace BillingApp.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "BillingApp";
    public string Audience { get; set; } = "BillingAppClients";
    /// <summary>HMAC key — minimum 32 characters for HS256.</summary>
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 14;
}
