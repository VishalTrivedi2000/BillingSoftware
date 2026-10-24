namespace BillingApp.Infrastructure.Billing;

public sealed class ProductImageStorageOptions
{
    public const string SectionName = "ProductImages";

    public string RelativeRoot { get; init; } = "uploads/products";

    public string PublicRequestPath { get; init; } = "/uploads/products";

    public long MaxPictureBytes { get; init; } = 5 * 1024 * 1024;
}
