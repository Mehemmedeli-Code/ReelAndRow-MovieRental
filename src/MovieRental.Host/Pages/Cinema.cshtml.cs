namespace MovieRental.Host.Pages;

public sealed class CinemaModel(IConfiguration configuration) : AppPageModel
{
    public void OnGet() => View = new AppPageViewModel(
        Title: "Cinema seats — Reel & Row",
        Tagline: "Pick your row, see what is already taken, book in one pass.",
        ActiveNav: "cinema",
        ReactMount: "cinema",
        Assets: FrontendAssets.From(configuration));
}
