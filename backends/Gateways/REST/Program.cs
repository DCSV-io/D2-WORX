// -----------------------------------------------------------------------
// <copyright file="Program.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

using D2.Contracts.ServiceDefaults;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
var app = builder.Build();
app.UseExceptionHandler();
app.UseStructuredRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapPrometheusEndpointWithIpRestriction();
app.MapDefaultEndpoints();

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
