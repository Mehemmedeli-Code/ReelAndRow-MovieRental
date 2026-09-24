using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MovieRental.Modules.Cinema.Domain;
using MovieRental.Modules.Cinema.Persistence;

namespace MovieRental.Modules.Cinema.Infrastructure;

/// <summary>
/// Sweeps up checkouts that were never confirmed.
///
/// Without this, an abandoned payment blocks its seats until somebody else happens to start
/// a checkout on the same screening — which might be never. Rows are deleted rather than
/// soft-deleted: the unique index on (screening, row, number) counts filtered rows, so a
/// lingering one would keep the seat off sale permanently.
/// </summary>
internal sealed class HoldExpiryService(IServiceScopeFactory scopes, ILogger<HoldExpiryService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // A minute is short enough that an abandoned basket frees up while the customer is
        // still deciding, and cheap enough to run forever.
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<CinemaDbContext>();

                var stale = await db.SeatPayments
                    .Include(p => p.Seats)
                    .Where(p => p.Status == PaymentStatus.AwaitingCode && p.ExpiresAtUtc < DateTime.UtcNow)
                    .ToListAsync(stoppingToken);

                if (stale.Count == 0) continue;

                foreach (var payment in stale)
                {
                    db.SeatBookings.RemoveRange(payment.Seats);
                    payment.Status = PaymentStatus.Expired;
                }

                await db.SaveChangesAsync(stoppingToken);
                logger.LogInformation("Released {Count} expired seat hold(s).", stale.Count);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                // Never let a sweep failure take the host down; it will try again next tick.
                logger.LogError(ex, "Seat hold sweep failed.");
            }
        }
    }
}
