using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using MovieRental.Modules.Identity.Domain;
using MovieRental.Modules.Identity.Infrastructure;
using MovieRental.Modules.Identity.Persistence;
using MovieRental.SharedKernel.Contracts;
using MovieRental.SharedKernel.Cqrs;
using MovieRental.SharedKernel.Results;
using MovieRental.SharedKernel.Security;

namespace MovieRental.Modules.Identity.Features;

// Feature 1 — registration. One file holds the whole slice: contract, rules, handler, route.
public sealed record RegisterCommand(string FullName, string Email, string Password, string? PhoneNumber)
    : ICommand<Result<AuthResponse>>;

internal sealed class RegisterValidator : AbstractValidator<RegisterCommand>
{
    public RegisterValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("Password needs at least one capital letter.")
            .Matches("[0-9]").WithMessage("Password needs at least one digit.");
        RuleFor(x => x.PhoneNumber).Matches(@"^\+?[0-9]{7,15}$")
            .When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber))
            .WithMessage("Use digits only, optionally starting with +.");
    }
}

internal sealed class RegisterHandler(
    IdentityDbContext db,
    IPasswordHasher hasher,
    ITokenService tokens,
    IEmailSender email,
    IHttpContextAccessor http)
    : ICommandHandler<RegisterCommand, Result<AuthResponse>>
{
    public async Task<Result<AuthResponse>> Handle(RegisterCommand command, CancellationToken ct)
    {
        var normalizedEmail = command.Email.Trim().ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail, ct))
            return Result.Failure<AuthResponse>(Error.Conflict("That e-mail is already registered."));

        var user = new AppUser
        {
            Email = normalizedEmail,
            FullName = command.FullName.Trim(),
            PhoneNumber = command.PhoneNumber?.Trim(),
            PasswordHash = hasher.Hash(command.Password),
            Roles = AppRoles.Customer
        };

        var refresh = tokens.CreateRefreshToken(user.Id, http.HttpContext?.Connection.RemoteIpAddress?.ToString());
        user.RefreshTokens.Add(refresh);

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        var link = tokens.CreateConfirmationLinkPayload(user.Id, "email-confirm");

        var body = $"""
            <p>Hi {user.FullName},</p>
            <p>Confirm your e-mail to start renting:</p>
            <p><a href="/api/auth/confirm-email?payload={link}">Confirm e-mail</a></p>
            """;

        await email.SendAsync(new EmailRequest(
            user.Email,
            "Confirm your Reel & Row account",
            body), ct);

        var access = tokens.CreateAccessToken(user);
        return Result.Success(new AuthResponse(access.Value, access.ExpiresAtUtc, refresh.Token, user.ToProfile()));
    }
}

public static class RegisterEndpoint
{
    public static void Map(IEndpointRouteBuilder app) =>
        app.MapPost("/api/auth/register",
            async Task<Results<Ok<AuthResponse>, Conflict<Error>>> (
                RegisterCommand command, IDispatcher dispatcher, CancellationToken ct) =>
            {
                var result = await dispatcher.Send(command, ct);
                return result.IsSuccess
                    ? TypedResults.Ok(result.Value)
                    : TypedResults.Conflict(result.Error);
            })
        .WithName("Register")
        .WithTags("Auth")
        .AllowAnonymous();
}

internal static class UserProfileMapper
{
    public static UserProfileResponse ToProfile(this AppUser user) => new(
        user.Id, user.FullName, user.Email, user.PhoneNumber,
        user.IsEmailConfirmed, user.IsPhoneConfirmed, user.RoleList);
}
