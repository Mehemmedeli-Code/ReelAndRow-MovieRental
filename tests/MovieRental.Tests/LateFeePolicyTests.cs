using MovieRental.Modules.Rentals.Domain;

namespace MovieRental.Tests;

/// <summary>
/// The late fee is the one piece of money arithmetic in the project, and it is applied in
/// three places — the return endpoint, the rental list and the nightly notifier. If those
/// three ever disagreed, customers would see one number and be charged another. Keeping the
/// rule a pure function of (rental, now) is what makes these tests possible at all.
/// </summary>
public class LateFeePolicyTests
{
    private static readonly LateFeePolicy Policy = new();
    private static readonly DateTime Due = new(2026, 5, 1, 12, 0, 0, DateTimeKind.Utc);

    private static Rental RentalDueAt(DateTime due, decimal dailyPrice = 3m, DateTime? returned = null) => new()
    {
        MovieTitle = "Blue Hour",
        DueAtUtc = due,
        DailyPrice = dailyPrice,
        ReturnedAtUtc = returned
    };

    [Fact]
    public void Returned_before_the_due_date_costs_nothing()
    {
        var fee = Policy.Calculate(RentalDueAt(Due, returned: Due.AddDays(-2)), Due);
        Assert.Equal(0m, fee);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(3)]
    [InlineData(6)]
    public void Within_the_grace_period_costs_nothing(int hoursLate)
    {
        // Six hours of slack, so someone who drops the disc back the same evening is not
        // charged for a whole extra day.
        var fee = Policy.Calculate(RentalDueAt(Due), Due.AddHours(hoursLate));
        Assert.Equal(0m, fee);
    }

    [Fact]
    public void One_minute_past_the_grace_period_starts_charging()
    {
        var fee = Policy.Calculate(RentalDueAt(Due), Due.AddHours(6).AddMinutes(1));
        Assert.True(fee > 0m, "the grace period should end, not extend indefinitely");
    }

    [Fact]
    public void A_part_day_is_charged_as_a_whole_day()
    {
        // 25 hours late rounds up to two days: 3.00 x 1.5 x 2.
        var fee = Policy.Calculate(RentalDueAt(Due), Due.AddHours(25));
        Assert.Equal(9.00m, fee);
    }

    [Fact]
    public void The_fee_is_capped_at_ten_days_of_rental()
    {
        // A year overdue would otherwise run to hundreds. An unreturned disc should never
        // cost more than replacing it.
        var fee = Policy.Calculate(RentalDueAt(Due), Due.AddDays(365));
        Assert.Equal(30.00m, fee);
    }

    [Fact]
    public void A_returned_rental_is_judged_by_its_return_date_not_by_now()
    {
        // Returned two days late, examined a year later. The customer owes for the two days
        // they actually had it, not for the time since.
        var rental = RentalDueAt(Due, returned: Due.AddDays(2));
        var fee = Policy.Calculate(rental, Due.AddDays(365));
        Assert.Equal(9.00m, fee);
    }

    [Fact]
    public void A_dearer_film_accrues_a_dearer_fee()
    {
        var cheap = Policy.Calculate(RentalDueAt(Due, dailyPrice: 2m), Due.AddHours(25));
        var dear = Policy.Calculate(RentalDueAt(Due, dailyPrice: 8m), Due.AddHours(25));
        Assert.True(dear > cheap);
    }
}
