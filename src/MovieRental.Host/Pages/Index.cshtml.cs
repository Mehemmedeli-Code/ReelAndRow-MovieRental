namespace MovieRental.Host.Pages;

public sealed class IndexModel(IConfiguration configuration) : AppPageModel
{
    public void OnGet() => View = new AppPageViewModel(
        Title: "Reel & Row — rent films, book seats",
        Tagline: "A rental catalogue, a cinema seat map and a shorts festival in one place.",
        ActiveNav: "home",
        ReactMount: "home",
        Assets: FrontendAssets.From(configuration));
}
