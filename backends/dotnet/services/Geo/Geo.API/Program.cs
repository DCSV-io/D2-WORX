// -----------------------------------------------------------------------
// <copyright file="Program.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

using D2.Shared.GeoRefDataService.Default;
using D2.Shared.Handler.Extensions;
using D2.Shared.ServiceDefaults;
using D2.Shared.Utilities.Extensions;
using D2.Geo.App;
using D2.Geo.Infra;
using Geo.API.Services;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Get required connection strings from configuration.
var dbConnectionString =
    builder.Configuration.GetConnectionString("d2-services-geo");
var distributedCacheConnectionString =
    builder.Configuration.GetConnectionString("d2-redis");
var messageQueueConnectionString =
    builder.Configuration.GetConnectionString("d2-rabbitmq");
string?[] reqConnStrings =
[
    dbConnectionString,
    distributedCacheConnectionString,
    messageQueueConnectionString
];
if (reqConnStrings.Any(x => x.Falsey()))
{
    throw new InvalidOperationException(
        "One or more required connection strings are missing.");
}

// Add services to the container.
builder.AddServiceDefaults();
builder.Services.AddProblemDetails();
builder.Services.AddGrpc();
builder.Services.AddHandlerContext();
builder.Services.AddGeoInfra(
    builder.Configuration,
    dbConnectionString!,
    distributedCacheConnectionString!,
    messageQueueConnectionString!);
builder.Services.AddGeoRefDataProvider();
builder.Services.AddGeoApp(builder.Configuration);

// Build app and use middleware.
var app = builder.Build();
app.UseStructuredRequestLogging();
app.MapPrometheusEndpointWithIpRestriction();
app.MapGrpcService<GeoService>();

// Map default REST endpoints (for health checks).
app.MapGet(
    "/",
    () => "Communication with gRPC endpoints must be made through a gRPC client.");
app.MapDefaultEndpoints();

// Run the app and handle startup errors.
try
{
    Log.Information("Starting Geo.API service");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Geo.API service failed to start");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
