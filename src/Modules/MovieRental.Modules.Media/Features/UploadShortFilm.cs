using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using MovieRental.Modules.Media.Domain;
using MovieRental.Modules.Media.Persistence;
using MovieRental.SharedKernel.Contracts;
using MovieRental.SharedKernel.Cqrs;
using MovieRental.SharedKernel.Results;
using MovieRental.SharedKernel.Security;

namespace MovieRental.Modules.Media.Features;

public sealed record ShortFilmResponse(
    Guid Id, string Title, string Synopsis, string AuthorName, string OriginalFileName,
    long SizeBytes, SubmissionStatus Status, DateTime SubmittedAtUtc, DateTime ReviewDeadlineUtc,
    int HoursLeft, string? ReviewerNote);

public sealed record UploadShortFilmCommand(
    string Title, string Synopsis, string OriginalFileName, string ContentType, Stream Content, long SizeBytes)
    : ICommand<Result<ShortFilmResponse>>;

internal sealed class UploadShortFilmHandler(
    MediaDbContext db, ICurrentUser currentUser, IUserDirectory users, IHostEnvironment environment)
    : ICommandHandler<UploadShortFilmCommand, Result<ShortFilmResponse>>
{
    private const long MaxBytes = 512L * 1024 * 1024;
    private static readonly string[] AllowedExtensions = [".mp4", ".mov", ".webm", ".mkv"];

    public async Task<Result<ShortFilmResponse>> Handle(UploadShortFilmCommand command, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(command.Title))
            return Result.Failure<ShortFilmResponse>(Error.Validation("Give your film a title."));
        if (command.SizeBytes is 0 or > MaxBytes)
            return Result.Failure<ShortFilmResponse>(Error.Validation("Upload a file between 1 byte and 512 MB."));

        var extension = Path.GetExtension(command.OriginalFileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            return Result.Failure<ShortFilmResponse>(Error.Validation($"Supported formats: {string.Join(", ", AllowedExtensions)}."));

        var userId = currentUser.RequireId();
        var contact = await users.GetContactAsync(userId, ct);

        // Stored under a generated name: the uploader's filename never reaches the file
        // system, so path traversal and collisions are both off the table.
        var storedName = $"{Guid.NewGuid():N}{extension}";
        var folder = Path.Combine(environment.ContentRootPath, "uploads", "shorts");
        Directory.CreateDirectory(folder);

        await using (var target = File.Create(Path.Combine(folder, storedName)))
            await command.Content.CopyToAsync(target, ct);

        var film = new ShortFilm
        {
            UserId = userId,
            AuthorName = contact?.FullName ?? "Unknown",
            Title = command.Title.Trim(),
            Synopsis = command.Synopsis.Trim(),
            StoredFileName = storedName,
            OriginalFileName = Path.GetFileName(command.OriginalFileName),
            ContentType = command.ContentType,
            SizeBytes = command.SizeBytes,
            SubmittedAtUtc = DateTime.UtcNow,
            ReviewDeadlineUtc = DateTime.UtcNow.AddDays(3)
        };

        db.ShortFilms.Add(film);
        await db.SaveChangesAsync(ct);
        return Result.Success(film.ToResponse(DateTime.UtcNow));
    }
}

public sealed record GetMySubmissionsQuery : IQuery<IReadOnlyList<ShortFilmResponse>>;

internal sealed class GetMySubmissionsHandler(MediaDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetMySubmissionsQuery, IReadOnlyList<ShortFilmResponse>>
{
    public async Task<IReadOnlyList<ShortFilmResponse>> Handle(GetMySubmissionsQuery query, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var films = await db.ShortFilms.AsNoTracking()
            .Where(f => f.UserId == currentUser.RequireId())
            .OrderByDescending(f => f.SubmittedAtUtc)
            .ToListAsync(ct);

        return films.Select(f => f.ToResponse(now)).ToList();
    }
}

public static class UploadShortFilmEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/shorts", async (HttpRequest request, IDispatcher dispatcher, CancellationToken ct) =>
            {
                if (!request.HasFormContentType) return Results.BadRequest(Error.Validation("Send the film as multipart/form-data."));

                var form = await request.ReadFormAsync(ct);
                var file = form.Files.GetFile("file");
                if (file is null) return Results.BadRequest(Error.Validation("No file was attached."));

                await using var stream = file.OpenReadStream();
                var result = await dispatcher.Send(new UploadShortFilmCommand(
                    form["title"].ToString(), form["synopsis"].ToString(),
                    file.FileName, file.ContentType, stream, file.Length), ct);

                return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
            })
        .WithName("UploadShortFilm").WithTags("Shorts").RequireAuthorization()
        .DisableAntiforgery();

        app.MapGet("/api/shorts/mine", async (IDispatcher dispatcher, CancellationToken ct) =>
                Results.Ok(await dispatcher.Ask(new GetMySubmissionsQuery(), ct)))
            .WithName("GetMyShortFilms").WithTags("Shorts").RequireAuthorization();
    }
}

internal static class ShortFilmMapper
{
    public static ShortFilmResponse ToResponse(this ShortFilm f, DateTime nowUtc) => new(
        f.Id, f.Title, f.Synopsis, f.AuthorName, f.OriginalFileName, f.SizeBytes,
        f.Status, f.SubmittedAtUtc, f.ReviewDeadlineUtc, f.HoursLeft(nowUtc), f.ReviewerNote);
}
