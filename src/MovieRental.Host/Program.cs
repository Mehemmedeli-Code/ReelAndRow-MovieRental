using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MovieRental.Host.Infrastructure;
using MovieRental.Host.Middleware;
using MovieRental.Modules.Catalog;
using MovieRental.Modules.Cinema;
using MovieRental.Modules.Identity;
using MovieRental.Modules.Identity.Infrastructure;
using MovieRental.Modules.Media;
using MovieRental.Modules.Rentals;
using MovieRental.SharedKernel.Cqrs;
using MovieRental.SharedKernel.Cqrs.Behaviors;
using MovieRental.SharedKernel.Modules;
using MovieRental.SharedKernel.Security;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Composition. Program.cs knows the list of modules and nothing about their insides.
// ---------------------------------------------------------------------------
builder.Services.AddModules(
    builder.Configuration,
    new IdentityModule(),
    new CatalogModule(),
    new RentalsModule(),
    new CinemaModule(),
    new MediaModule());

builder.Services.AddScoped<IDispatcher, Dispatcher>();
builder.Services.AddScoped(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
builder.Services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------
var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
          ?? throw new InvalidOperationException("The Jwt configuration section is missing.");

if (jwt.SecretKey.Length < 32)
    throw new InvalidOperationException("Jwt:SecretKey must be at least 32 characters. Use user secrets, not appsettings.json.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = TokenService.SigningKey(jwt.SecretKey),
            // Default is five minutes of slack, which quietly extends every token's life.
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(AppRoles.Admin, policy => policy.RequireRole(AppRoles.Admin))
    .AddPolicy(AppRoles.Customer, policy => policy.RequireAuthenticatedUser());

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------
builder.Services.AddRazorPages();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Reel & Row API", Version = "v1" });

    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the access token returned by /api/auth/login.",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };

    options.AddSecurityDefinition("Bearer", scheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { [scheme] = [] });
});

// The Vite dev server runs on its own origin while you develop; in production the React
// bundle is served by this host, so no cross-origin request exists at all.
const string DevCors = "vite-dev";
builder.Services.AddCors(options => options.AddPolicy(DevCors, policy => policy
    .WithOrigins(builder.Configuration["Frontend:DevServerUrl"] ?? "http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

// ---------------------------------------------------------------------------
// Pipeline. Order matters: exceptions first so everything below is covered.
// ---------------------------------------------------------------------------
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseCors(DevCors);
    app.UseSwagger();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "Reel & Row API v1"));
    await DevelopmentDatabaseBootstrapper.InitialiseAsync(app.Services);
}
else
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages();
app.MapModules();
AnalyticsEndpoints.Map(app);

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }))
   .WithTags("System").AllowAnonymous();

app.Run();
