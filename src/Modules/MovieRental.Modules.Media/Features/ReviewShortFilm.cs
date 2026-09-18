using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using MovieRental.Modules.Media.Domain;
using MovieRental.Modules.Media.Persistence;
using MovieRental.SharedKernel.Contracts;
using MovieRental.SharedKernel.Cqrs;
using MovieRental.SharedKernel.Results;
using MovieRental.SharedKernel.Security;

namespace MovieRental.Modules.Media.Features;

// Feature 12 (continued) — the manual approval queue, ordered by how close each
// submission is to breaching its three-day promise.
public sealed record GetPendingShortsQuery : IQuery<IReadOnlyList<ShortFilmResponse>>;

internal sealed class GetPendingShortsHandler(MediaDbContext db)
    : IQueryHandler<GetPendingShortsQuery, IReadOnlyList<ShortFilmResponse>>
{
    public async Task<IReadOnlyList<ShortFilmResponse>> Handle(GetPendingShortsQuery query, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var pending = await db.ShortFilms.AsNoTracking()
            .Where(f => f.Status == SubmissionStatus.Pending)
            .OrderBy(f => f.ReviewDeadlineUtc)
            .ToListAsync(ct);

        return pending.Select(f => f.ToResponse(now)).ToList();
    }
}

public sealed record DecideShortFilmCommand(Guid Id, bool Approve, string? Note) : ICommand<Result>;

internal sealed class DecideShortFilmHandler(
    MediaDbContext db, ICurrentUser currentUser, IUserDirectory users, IEmailSender email)
    : ICommandHandler<DecideShortFilmCommand, Result>
{
    public async Task<Result> Handle(DecideShortFilmCommand command, CancellationToken ct)
    {
        var film = await db.ShortFilms.FirstOrDefaultAsync(f => f.Id == command.Id, ct);
        if (film is null) return Result.Failure(Error.NotFound("Submission"));
        if (film.Status != SubmissionStatus.Pending)
            return Result.Failure(Error.Conflict("This submission has already been decided."));

        film.Status = command.Approve ? SubmissionStatus.Approved : SubmissionStatus.Rejected;
        film.ReviewedAtUtc = DateTime.UtcNow;
        film.ReviewedByUserId = currentUser.RequireId();
        film.ReviewerNote = command.Note?.Trim();

        await db.SaveChangesAsync(ct);

        var contact = await users.GetContactAsync(film.UserId, ct);
        if (contact is not null)
        {
            var verdict = command.Approve ? "is now live" : "was not accepted";
            await email.SendAsync(new EmailRequest(contact.Email, $"\"{film.Title}\" {verdict}",
                $"<p>{film.ReviewerNote ?? "Thanks for submitting to Reel &amp; Row."}</p>"), ct);
        }

        return Result.Success();
    }
}

public static class ReviewShortFilmEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/admin/shorts").WithTags("Shorts").RequireAuthorization(AppRoles.Admin);

        admin.MapGet("/pending", async (IDispatcher dispatcher, CancellationToken ct) =>
                Results.Ok(await dispatcher.Ask(new GetPendingShortsQuery(), ct)))
            .WithName("GetPendingShorts");

        admin.MapPut("/{id:guid}/decision", async Task<Results<NoContent, Conflict<Error>, NotFound<Error>>> (
            Guid id, DecideShortFilmCommand body, IDispatcher dispatcher, CancellationToken ct) =>
        {
            var result = await dispatcher.Send(body with { Id = id }, ct);
            if (result.IsSuccess) return TypedResults.NoContent();
            return result.Error.Code == "not_found"
                ? TypedResults.NotFound(result.Error)
                : TypedResults.Conflict(result.Error);
        }).WithName("DecideShortFilmWithId");

        admin.MapDelete("/{id:guid}", async Task<Results<NoContent, NotFound>> (
            Guid id, MediaDbContext db, CancellationToken ct) =>
        {
            var film = await db.ShortFilms.FirstOrDefaultAsync(f => f.Id == id, ct);
            if (film is null) return TypedResults.NotFound();

            db.ShortFilms.Remove(film);   // soft delete — the file stays for any appeal
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        }).WithName("SoftDeleteShortFilmWithId");
    }
}
