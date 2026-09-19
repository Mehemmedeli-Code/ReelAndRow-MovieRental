namespace MovieRental.Modules.Identity.Features;

public sealed record AuthResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAtUtc,
    string RefreshToken,
    UserProfileResponse User);

public sealed record UserProfileResponse(
    Guid Id, string FullName, string Email, string? PhoneNumber,
    bool IsEmailConfirmed, bool IsPhoneConfirmed, string[] Roles);
