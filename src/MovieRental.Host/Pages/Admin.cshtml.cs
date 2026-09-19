namespace MovieRental.Host.Pages;

public sealed class AdminModel(IConfiguration configuration) : AppPageModel
{
    public void OnGet() => View = new AppPageViewModel(
        Title: "Admin — Reel & Row",
        Tagline: "Inventory, overdue rentals, submissions and benchmark charts.",
        ActiveNav: "admin",
        ReactMount: "admin",
        Assets: FrontendAssets.From(configuration));
}
