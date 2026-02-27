// -----------------------------------------------------------------------
// <copyright file="Program.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

using System.Text.Json.Serialization;
using D2.Gateways.REST.Auth;
using D2.Gateways.REST.Endpoints;
using D2.Geo.Client;
using D2.Shared.DistributedCache.Redis;
using D2.Shared.Handler.Extensions;
using D2.Shared.Idempotency.Default;
using D2.Shared.RateLimit.Default;
using D2.Shared.RequestEnrichment.Default;
using D2.Shared.ServiceDefaults;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Validate required configuration.
var redisConnectionString = builder.Configuration.GetConnectionString("d2-redis");
if (string.IsNullOrWhiteSpace(redisConnectionString))
{
    throw new InvalidOperationException("Redis connection string 'd2-redis' is missing.");
}

builder.AddServiceDefaults();
builder.Services.AddHandlerContext();
builder.Services.AddProblemDetails(opts =>
{
    opts.CustomizeProblemDetails = ctx =>
    {
        if (!builder.Environment.IsDevelopment())
        {
            ctx.ProblemDetails.Detail = null;
            ctx.ProblemDetails.Title = "An error occurred processing your request.";
        }
    };
});
builder.Services.AddOpenApi();

// Configure global JSON serialization: camelCase + enums as strings.
builder.Services.ConfigureHttpJsonOptions(opts =>
{
    opts.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// Register gRPC clients.
builder.Services.AddGeoGrpcClient(builder.Configuration);

// Register WhoIs cache for request enrichment.
builder.Services.AddWhoIsCache(builder.Configuration);

// Register distributed caching (Redis).
builder.Services.AddRedisCaching(redisConnectionString);

// Register request enrichment middleware services.
builder.Services.AddRequestEnrichment(builder.Configuration);

// Register rate limiting middleware services.
builder.Services.AddRateLimiting(builder.Configuration);

// Register JWT authentication.
builder.Services.AddJwtAuth(builder.Configuration);

// Register service-to-service API key authentication.
builder.Services.AddServiceKeyAuth(builder.Configuration);

// Register CORS.
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(builder.Configuration["CorsOrigin"] ?? "http://localhost:5173")
     .AllowCredentials()
     .WithHeaders("Content-Type", "Authorization", "Idempotency-Key", "X-Client-Fingerprint")
     .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")));

// Request body size limit (256 KB — gateway payloads are small JSON).
builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = 256 * 1024);

// Register idempotency middleware services.
builder.Services.AddIdempotency(builder.Configuration);

// Register gRPC clients + HTTP client for health endpoint fan-out.
builder.Services.AddHealthEndpointDependencies(builder.Configuration);

var app = builder.Build();

// Security headers — before exception handler so they apply to all responses.
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    await next();
});

app.UseExceptionHandler();
app.UseStructuredRequestLogging();
app.UseCors();
app.UseRequestEnrichment();
app.UseServiceKeyDetection();
app.UseRateLimiting();

app.UseJwtAuth();
app.UseIdempotency();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapPrometheusEndpointWithIpRestriction();
app.MapDefaultEndpoints();

// Map versioned API endpoints.
app.MapGeoEndpointsV1();
app.MapHealthEndpointsV1();

try
{
    Log.Information("Starting REST API service");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "REST API service failed to start");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
