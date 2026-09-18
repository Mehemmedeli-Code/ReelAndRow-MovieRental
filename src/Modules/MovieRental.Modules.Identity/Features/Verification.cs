using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MovieRental.Modules.Identity.Domain;
using MovieRental.Modules.Identity.Infrastructure;
using MovieRental.Modules.Identity.Persistence;
using MovieRental.SharedKernel.Contracts;
using MovieRental.SharedKernel.Cqrs;
using MovieRental.SharedKernel.Results;
using MovieRental.SharedKernel.Security;

namespace MovieRental.Modules.Identity.Features;

// Feature 1 (continued) — e-mail link confirmation and phone OTP.

public sealed record SendVerificationCommand(VerificationChannel Channel) : ICommand<Result>;

internal sealed class SendVerificationHandler(
    IdentityDbContext db, ITokenService tokens, IEmailSender email, ISmsSender sms,
    ICurrentUser currentUser, IOptions<JwtOptions> options)
    : ICommandHandler<SendVerificationCommand, Result>
{
    public async Task<Result> Handle(SendVerificationCommand command, CancellationToken ct)
    {
        var userId = currentUser.RequireId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Result.Failure(Error.NotFound("User"));

        var code = tokens.CreateNumericCode();
        db.VerificationCodes.Add(new VerificationCode
        {
            UserId = user.Id,
            Channel = command.Channel,
            Code = code,
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(options.Value.VerificationCodeMinutes)
        });
        await db.SaveChangesAsync(ct);

        if (command.Channel == VerificationChannel.Sms)
        {
            if (string.IsNullOrWhiteSpace(user.PhoneNumber))
                return Result.Failure(Error.Validation("Add a phone number to your profile first."));
            await sms.SendAsync(new SmsRequest(user.PhoneNumber, $"Your Reel & Row code is {code}."), ct);
        }
        else
        {
            await email.SendAsync(new EmailRequest(user.Email, "Your verification code",
                $"<p>Your code is <strong>{code}</strong>. It expires in {options.Value.VerificationCodeMinutes} minutes.</p>"), ct);
        }

        return Result.Success();
    }
}

public sealed record ConfirmCodeCommand(VerificationChannel Channel, string Code) : ICommand<Result>;

internal sealed class ConfirmCodeHandler(IdentityDbContext db, ICurrentUser currentUser)
    : ICommandHandler<ConfirmCodeCommand, Result>
{
    public async Task<Result> Handle(ConfirmCodeCommand command, CancellationToken ct)
    {
        var userId = currentUser.RequireId();

        var pending = await db.VerificationCodes
            .Where(c => c.UserId == userId && c.Channel == command.Channel && c.ConsumedAtUtc == null)
            .OrderByDescending(c => c.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (pending is null || !pending.IsUsable)
            return Result.Failure(Error.Validation("That code is no longer valid. Request a new one."));

        if (pending.Code != command.Code)
        {
            pending.Attempts++;
            await db.SaveChangesAsync(ct);
            return Result.Failure(Error.Validation("Incorrect code."));
        }

        var user = await db.Users.FirstAsync(u => u.Id == userId, ct);
        if (command.Channel == VerificationChannel.Email) user.IsEmailConfirmed = true;
        else user.IsPhoneConfirmed = true;

        pending.ConsumedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public static class VerificationEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/auth/verification/send",
            async Task<Results<NoContent, BadRequest<Error>>> (
                SendVerificationCommand command, IDispatcher dispatcher, CancellationToken ct) =>
            {
                var result = await dispatcher.Send(command, ct);
                return result.IsSuccess ? TypedResults.NoContent() : TypedResults.BadRequest(result.Error);
            })
        .WithName("SendVerification").WithTags("Auth").RequireAuthorization();

        app.MapPost("/api/auth/verification/confirm",
            async Task<Results<NoContent, BadRequest<Error>>> (
                ConfirmCodeCommand command, IDispatcher dispatcher, CancellationToken ct) =>
            {
                var result = await dispatcher.Send(command, ct);
                return result.IsSuccess ? TypedResults.NoContent() : TypedResults.BadRequest(result.Error);
            })
        .WithName("ConfirmVerificationCode").WithTags("Auth").RequireAuthorization();

        // Base64url payload straight out of the confirmation e-mail.
        app.MapGet("/api/auth/confirm-email",
            async Task<Results<Ok<string>, BadRequest<Error>>> (
                string payload, ITokenService tokens, IdentityDbContext db, CancellationToken ct) =>
            {
                if (!tokens.TryReadConfirmationLinkPayload(payload, out var userId, out var purpose) ||
                    purpose != "email-confirm")
                    return TypedResults.BadRequest(Error.Validation("This confirmation link is invalid or expired."));

                var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
                if (user is null) return TypedResults.BadRequest(Error.NotFound("User"));

                user.IsEmailConfirmed = true;
                await db.SaveChangesAsync(ct);
                return TypedResults.Ok("E-mail confirmed. You can close this tab.");
            })
        .WithName("ConfirmEmailLink").WithTags("Auth").AllowAnonymous();
    }
}
