using MovieRental.Host.Infrastructure.Localization;
using MovieRental.SharedKernel.Security;

namespace MovieRental.Host.Infrastructure.Assistant;

public sealed record AskAssistantRequest(IReadOnlyList<AssistantTurn> Messages);

/// <summary>
/// Stateless on purpose: the client sends the conversation each turn and the server stores
/// nothing. No table, no retention question, and no transcript of what people asked support
/// sitting in a database nobody remembers is there.
/// </summary>
public static class AssistantEndpoints
{
    private const int MaxTurns = 20;
    private const int MaxLength = 2000;

    public static void Map(IEndpointRouteBuilder app) =>
        app.MapPost("/api/assistant", async (
                AskAssistantRequest body, IAssistant assistant, ILanguageContext language, CancellationToken ct) =>
            {
                var turns = (body.Messages ?? [])
                    .Where(t => t.Role is "user" or "assistant" && !string.IsNullOrWhiteSpace(t.Content))
                    // Trimmed at both ends: a long tail costs tokens, and a single enormous
                    // message is the cheapest way to run up a bill on somebody else's key.
                    .TakeLast(MaxTurns)
                    .Select(t => t with { Content = t.Content.Trim()[..Math.Min(t.Content.Trim().Length, MaxLength)] })
                    .ToList();

                if (turns.Count == 0 || turns[^1].Role != "user")
                    return Results.BadRequest(new { code = "empty", message = "Ask a question first." });

                return Results.Ok(await assistant.AskAsync(turns, language.Code, ct));
            })
        .WithName("AskAssistant").WithTags("Assistant").AllowAnonymous()
        .RequireRateLimiting(AppPolicies.CodeRateLimit);
}
