// -----------------------------------------------------------------------
// <copyright file="Program.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

using D2.Gateways.REST.Endpoints;
using D2.Geo.Client;
using D2.Shared.RateLimit.Redis;
using D2.Shared.RequestEnrichment;
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
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

// Register gRPC clients.
builder.Services.AddGeoGrpcClient(builder.Configuration);

// Register WhoIs cache for request enrichment.
builder.Services.AddWhoIsCache(builder.Configuration);

// Register request enrichment middleware services.
builder.Services.AddRequestEnrichment(builder.Configuration);

// Register rate limiting middleware services.
builder.Services.AddRateLimiting(redisConnectionString!, builder.Configuration);

var app = builder.Build();
app.UseExceptionHandler();
app.UseStructuredRequestLogging();
app.UseRequestEnrichment();
app.UseRateLimiting();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapPrometheusEndpointWithIpRestriction();
app.MapDefaultEndpoints();

// Map versioned API endpoints.
app.MapGeoEndpointsV1();

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
