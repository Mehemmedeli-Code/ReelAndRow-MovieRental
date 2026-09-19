using Microsoft.AspNetCore.Mvc.RazorPages;

namespace MovieRental.Host.Pages;

/// <summary>
/// Every page carries a strongly-typed view model. ViewBag and ViewData are deliberately
/// unused across this project: they are untyped, invisible to the compiler and silently
/// return null when a key is misspelled.
/// </summary>
public abstract class AppPageModel : PageModel
{
    public AppPageViewModel View { get; protected set; } = AppPageViewModel.Empty;
}

public sealed record AppPageViewModel(
    string Title,
    string Tagline,
    string ActiveNav,
    string ReactMount,
    FrontendAssets Assets)
{
    public static readonly AppPageViewModel Empty =
        new("Reel & Row", string.Empty, string.Empty, "home", new FrontendAssets(false, string.Empty));
}

/// <summary>
/// Resolves where the React bundle comes from. In development the Vite dev server serves
/// modules straight from disk with hot reload; in any other environment the built bundle
/// sits in wwwroot/app with fixed filenames, so no manifest lookup is needed.
/// </summary>
public sealed record FrontendAssets(bool UseDevServer, string DevServerUrl)
{
    public string ScriptUrl => UseDevServer ? $"{DevServerUrl}/src/main.tsx" : "/app/app.js";
    public string? StyleUrl => UseDevServer ? null : "/app/app.css";
    public string? ViteClientUrl => UseDevServer ? $"{DevServerUrl}/@vite/client" : null;

    public static FrontendAssets From(IConfiguration configuration) => new(
        configuration.GetValue("Frontend:UseDevServer", false),
        configuration["Frontend:DevServerUrl"] ?? "http://localhost:5173");
}
