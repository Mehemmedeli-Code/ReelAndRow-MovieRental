using MovieRental.SharedKernel.Abstractions;

namespace MovieRental.Modules.Media.Domain;

public enum SubmissionStatus { Pending = 1, Approved = 2, Rejected = 3, Expired = 4 }

/// <summary>Feature 12 — a customer-uploaded short awaiting a human decision.</summary>
public sealed class ShortFilm : BaseEntity, ISoftDeletable
{
    public Guid UserId { get; set; }
    public required string AuthorName { get; set; }
    public required string Title { get; set; }
    public string Synopsis { get; set; } = string.Empty;

    public required string StoredFileName { get; set; }
    public required string OriginalFileName { get; set; }
    public long SizeBytes { get; set; }
    public string ContentType { get; set; } = "video/mp4";

    public SubmissionStatus Status { get; set; } = SubmissionStatus.Pending;
    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>Every submission gets an answer within three days. The deadline is stored
    /// rather than computed so shifting the SLA later never rewrites old promises.</summary>
    public DateTime ReviewDeadlineUtc { get; set; } = DateTime.UtcNow.AddDays(3);

    public DateTime? ReviewedAtUtc { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public string? ReviewerNote { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public int HoursLeft(DateTime nowUtc) =>
        Status != SubmissionStatus.Pending ? 0 : Math.Max(0, (int)(ReviewDeadlineUtc - nowUtc).TotalHours);
}
