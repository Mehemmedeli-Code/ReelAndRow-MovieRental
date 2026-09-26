using Microsoft.EntityFrameworkCore;
using MovieRental.Modules.Rentals.Persistence;
using MovieRental.SharedKernel.Contracts;

namespace MovieRental.Modules.Rentals.Infrastructure;

internal sealed class RentalApi(RentalsDbContext db) : IRentalApi
{
    public Task<bool> HasRentedAsync(Guid userId, Guid movieId, CancellationToken ct = default) =>
        db.Rentals.AsNoTracking().AnyAsync(r => r.UserId == userId && r.MovieId == movieId, ct);

    public async Task<IReadOnlyList<Guid>> RentedMovieIdsAsync(Guid userId, CancellationToken ct = default) =>
        await db.Rentals.AsNoTracking()
            .Where(r => r.UserId == userId)
            .Select(r => r.MovieId)
            .Distinct()
            .ToListAsync(ct);
}
