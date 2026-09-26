namespace MovieRental.SharedKernel.Contracts;

/// <summary>
/// What the Rentals module will answer about a customer's history, for modules that need it
/// without owning it. Catalog uses this to decide who may review a film.
/// </summary>
public interface IRentalApi
{
    /// <summary>True if this customer has ever taken the film out. Past rentals count as much
    /// as current ones — having returned it is not a reason to lose your say.</summary>
    Task<bool> HasRentedAsync(Guid userId, Guid movieId, CancellationToken ct = default);

    /// <summary>Every film this customer has ever taken out. Catalog turns these into genres;
    /// Rentals does not know what a genre is, and should not have to.</summary>
    Task<IReadOnlyList<Guid>> RentedMovieIdsAsync(Guid userId, CancellationToken ct = default);
}
