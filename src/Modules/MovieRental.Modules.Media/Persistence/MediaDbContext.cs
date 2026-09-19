using Microsoft.EntityFrameworkCore;
using MovieRental.Modules.Media.Domain;
using MovieRental.SharedKernel.Persistence;

namespace MovieRental.Modules.Media.Persistence;

public sealed class MediaDbContext(DbContextOptions<MediaDbContext> options) : ModuleDbContext(options)
{
    public const string SchemaName = "media";
    public override string Schema => SchemaName;

    public DbSet<ShortFilm> ShortFilms => Set<ShortFilm>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<ShortFilm>(e =>
        {
            e.ToTable("ShortFilms");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.AuthorName).HasMaxLength(150).IsRequired();
            e.Property(x => x.Synopsis).HasMaxLength(2000);
            e.Property(x => x.StoredFileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.OriginalFileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(120);
            e.Property(x => x.ReviewerNote).HasMaxLength(1000);
            e.Property(x => x.Status).HasConversion<int>();
            e.HasIndex(x => new { x.Status, x.ReviewDeadlineUtc });
            e.HasIndex(x => x.UserId);
        });

        base.OnModelCreating(b);
    }
}
