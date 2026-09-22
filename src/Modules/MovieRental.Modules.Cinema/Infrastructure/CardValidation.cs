using MovieRental.Modules.Cinema.Domain;

namespace MovieRental.Modules.Cinema.Infrastructure;

/// <summary>
/// Card checks that can be done without an acquirer: the Luhn checksum, the brand prefix,
/// an expiry in the future and a CVC of the right length. These catch typos, which is what
/// most failed payments actually are. They prove nothing about funds.
/// </summary>
internal static class CardValidation
{
    public static string Digits(string? value) =>
        new(value?.Where(char.IsDigit).ToArray() ?? []);

    /// <summary>Luhn: double every second digit from the right, subtract 9 when that goes
    /// above nine, and the total must divide by ten.</summary>
    public static bool PassesLuhn(string digits)
    {
        if (digits.Length is < 12 or > 19) return false;

        var sum = 0;
        var doubling = false;

        for (var i = digits.Length - 1; i >= 0; i--)
        {
            var digit = digits[i] - '0';
            if (doubling)
            {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            doubling = !doubling;
        }

        return sum % 10 == 0;
    }

    public static CardBrand BrandOf(string digits)
    {
        if (digits.StartsWith('4')) return CardBrand.Visa;

        if (digits.Length >= 2 && int.TryParse(digits[..2], out var two) && two is >= 51 and <= 55)
            return CardBrand.Mastercard;

        // Mastercard's 2-series, added in 2017 and still missed by a lot of naive checks.
        if (digits.Length >= 4 && int.TryParse(digits[..4], out var four) && four is >= 2221 and <= 2720)
            return CardBrand.Mastercard;

        return CardBrand.Unknown;
    }

    public static bool ExpiryIsFuture(int month, int year)
    {
        if (month is < 1 or > 12) return false;
        if (year < 100) year += 2000;

        var lastDay = new DateTime(year, month, DateTime.DaysInMonth(year, month), 23, 59, 59, DateTimeKind.Utc);
        return lastDay >= DateTime.UtcNow;
    }

    public static bool CvcLooksRight(string cvc) => cvc.Length is 3 or 4 && cvc.All(char.IsDigit);
}
