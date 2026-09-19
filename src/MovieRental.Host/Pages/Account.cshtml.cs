namespace MovieRental.Host.Pages;

public sealed class AccountModel(IConfiguration configuration) : AppPageModel
{
    public void OnGet() => View = new AppPageViewModel(
        Title: "Sign in — Reel & Row",
        Tagline: "Sign in or create an account to rent and book.",
        ActiveNav: "account",
        ReactMount: "account",
        Assets: FrontendAssets.From(configuration));
}
