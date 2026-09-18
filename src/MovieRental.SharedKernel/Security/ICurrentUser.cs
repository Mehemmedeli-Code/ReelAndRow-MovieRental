namespace MovieRental.SharedKernel.Security;

public interface ICurrentUser
{
    Guid? Id { get; }
    string? Email { get; }
    IReadOnlyList<string> Roles { get; }
    bool IsAuthenticated { get; }
    bool IsInRole(string role);
    Guid RequireId();
}

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Customer = "Customer";
}
