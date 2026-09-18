namespace MovieRental.Host.Pages;

public sealed class RentalsModel(IConfiguration configuration) : AppPageModel
{
    public void OnGet() => View = new AppPageViewModel(
        Title: "My rentals — Reel & Row",
        Tagline: "Active, returned and overdue titles, with any late fee as it stands.",
        ActiveNav: "rentals",
        ReactMount: "rentals",
        Assets: FrontendAssets.From(configuration));
}
