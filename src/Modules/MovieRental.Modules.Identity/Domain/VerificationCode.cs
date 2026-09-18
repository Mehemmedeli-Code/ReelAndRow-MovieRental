using MovieRental.SharedKernel.Abstractions;

namespace MovieRental.Modules.Identity.Domain;

public enum VerificationChannel { Email = 1, Sms = 2 }

public sealed class VerificationCode : BaseEntity
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }

    public VerificationChannel Channel { get; set; }
    public required string Code { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? ConsumedAtUtc { get; set; }
    public int Attempts { get; set; }

    public bool IsUsable => ConsumedAtUtc is null && DateTime.UtcNow < ExpiresAtUtc && Attempts < 5;
}
