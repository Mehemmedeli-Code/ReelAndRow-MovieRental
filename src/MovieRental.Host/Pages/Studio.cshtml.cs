namespace MovieRental.Host.Pages;

public sealed class StudioModel(IConfiguration configuration) : AppPageModel
{
    public void OnGet() => View = new AppPageViewModel(
        Title: "Studio — Reel & Row",
        Tagline: "Upload a short film for review, or spin up a promo clip.",
        ActiveNav: "studio",
        ReactMount: "studio",
        Assets: FrontendAssets.From(configuration));
}
