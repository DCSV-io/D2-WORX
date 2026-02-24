// -----------------------------------------------------------------------
// <copyright file="HealthEndpoints.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Gateways.REST.Endpoints;

using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using D2.Services.Protos.Common.V1;
using D2.Services.Protos.Comms.V1;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.R;
using Grpc.Core;
using Serilog;

/// <summary>
/// Defines the aggregated health check endpoint that fans out to all services.
/// </summary>
public static class HealthEndpoints
{
    /// <summary>
    /// Extension methods for the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to extend.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Registers gRPC clients and HTTP clients needed for the health endpoint.
        /// Geo and Comms use gRPC; Auth uses HTTP (no gRPC server).
        /// </summary>
        ///
        /// <param name="configuration">
        /// The application configuration.
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddHealthEndpointDependencies(IConfiguration configuration)
        {
            // Comms gRPC client (Geo client is already registered via AddGeoGrpcClient).
            var commsAddress = configuration["services:d2-comms:comms-grpc:0"];
            if (!string.IsNullOrWhiteSpace(commsAddress))
            {
                services.AddGrpcClient<CommsService.CommsServiceClient>(o =>
                {
                    o.Address = new Uri(commsAddress);
                });
            }

            // Auth HTTP client (Auth is HTTP-only, no gRPC yet).
            services.AddHttpClient("health-auth", client =>
            {
                var address = configuration["services:d2-auth:auth-http:0"]
                              ?? configuration["services:d2-auth:http:0"];
                if (!string.IsNullOrWhiteSpace(address))
                {
                    client.BaseAddress = new Uri(address);
                }

                client.Timeout = TimeSpan.FromSeconds(5);
            });

            return services;
        }
    }

    /// <summary>
    /// Extension methods for the endpoint route builder.
    /// </summary>
    ///
    /// <param name="erb">
    /// The endpoint route builder to extend.
    /// </param>
    extension(IEndpointRouteBuilder erb)
    {
        /// <summary>
        /// Maps the aggregated health check endpoint.
        /// </summary>
        ///
        /// <returns>
        /// The updated endpoint route builder.
        /// </returns>
        public IEndpointRouteBuilder MapHealthEndpointsV1()
        {
            erb.MapGet("/api/health", CheckAllHealthAsync)
                .AllowAnonymous()
                .WithName("AggregatedHealthCheck")
                .WithSummary("Returns aggregated health status of all D2-WORX services.");

            return erb;
        }
    }

    private static readonly JsonSerializerOptions sr_jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// Handles the GET /api/health endpoint.
    /// Fans out to all services in parallel and aggregates the results.
    /// </summary>
    private static async Task<IResult> CheckAllHealthAsync(
        GeoService.GeoServiceClient geoClient,
        CommsService.CommsServiceClient commsClient,
        IHttpClientFactory httpClientFactory,
        IRead.IPingHandler cachePingHandler,
        CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var services = new Dictionary<string, object>();

        // Fan out to all services + gateway cache in parallel.
        var geoTask = CheckGrpcServiceAsync(geoClient, "geo", ct);
        var commsTask = CheckGrpcServiceAsync(commsClient, "comms", ct);
        var authTask = CheckAuthServiceAsync(httpClientFactory, ct);
        var cacheTask = CheckGatewayCacheAsync(cachePingHandler, ct);

        await Task.WhenAll(geoTask, authTask, commsTask, cacheTask);
        sw.Stop();

        // Gateway's own health.
        var cacheResult = await cacheTask;
        services["gateway"] = new
        {
            status = cacheResult.Status,
            latencyMs = cacheResult.LatencyMs,
            components = new Dictionary<string, object>
            {
                ["cache"] = new
                {
                    status = cacheResult.Status,
                    latencyMs = cacheResult.LatencyMs,
                    error = cacheResult.Error,
                },
            },
        };

        services["geo"] = await geoTask;
        services["auth"] = await authTask;
        services["comms"] = await commsTask;

        var allHealthy = cacheResult.Status == "healthy"
                         && HasHealthyStatus(await geoTask)
                         && HasHealthyStatus(await authTask)
                         && HasHealthyStatus(await commsTask);

        var overallStatus = allHealthy ? "healthy" : "degraded";

        Log.Information(
            "Health check completed: {Status} (geo={GeoStatus}, auth={AuthStatus}, comms={CommsStatus}, cache={CacheStatus}) in {ElapsedMs}ms",
            overallStatus,
            GetStatus(await geoTask),
            GetStatus(await authTask),
            GetStatus(await commsTask),
            cacheResult.Status,
            sw.ElapsedMilliseconds);

        var response = new
        {
            status = overallStatus,
            timestamp = DateTime.UtcNow.ToString("o"),
            services,
        };

        var statusCode = overallStatus == "healthy" ? 200 : 503;
        return Results.Json(response, sr_jsonOptions, statusCode: statusCode);
    }

    /// <summary>
    /// Calls a gRPC service's CheckHealth RPC and returns the mapped response.
    /// Works for any service whose client has a CheckHealthAsync method
    /// (Geo, Comms — both implement the CheckHealth RPC).
    /// </summary>
    private static async Task<object> CheckGrpcServiceAsync(
        GeoService.GeoServiceClient client,
        string serviceName,
        CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var response = await client.CheckHealthAsync(
                new CheckHealthRequest(),
                deadline: DateTime.UtcNow.AddSeconds(5),
                cancellationToken: ct);
            sw.Stop();

            return MapGrpcHealthResponse(response, sw.ElapsedMilliseconds);
        }
        catch (RpcException ex)
        {
            sw.Stop();
            Log.Warning(ex, "gRPC health check to {ServiceName} failed: {StatusCode}", serviceName, ex.StatusCode);
            return new
            {
                status = "unhealthy",
                latencyMs = sw.ElapsedMilliseconds,
                components = new Dictionary<string, object>
                {
                    ["error"] = new { status = "unhealthy", error = $"gRPC {ex.StatusCode}: {ex.Status.Detail}" },
                },
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            Log.Warning(ex, "Health check to {ServiceName} failed", serviceName);
            return new
            {
                status = "unhealthy",
                latencyMs = sw.ElapsedMilliseconds,
                components = new Dictionary<string, object>
                {
                    ["error"] = new { status = "unhealthy", error = ex.Message },
                },
            };
        }
    }

    /// <summary>
    /// Calls the Comms gRPC service's CheckHealth RPC and returns the mapped response.
    /// </summary>
    private static async Task<object> CheckGrpcServiceAsync(
        CommsService.CommsServiceClient client,
        string serviceName,
        CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var response = await client.CheckHealthAsync(
                new CheckHealthRequest(),
                deadline: DateTime.UtcNow.AddSeconds(5),
                cancellationToken: ct);
            sw.Stop();

            return MapGrpcHealthResponse(response, sw.ElapsedMilliseconds);
        }
        catch (RpcException ex)
        {
            sw.Stop();
            Log.Warning(ex, "gRPC health check to {ServiceName} failed: {StatusCode}", serviceName, ex.StatusCode);
            return new
            {
                status = "unhealthy",
                latencyMs = sw.ElapsedMilliseconds,
                components = new Dictionary<string, object>
                {
                    ["error"] = new { status = "unhealthy", error = $"gRPC {ex.StatusCode}: {ex.Status.Detail}" },
                },
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            Log.Warning(ex, "Health check to {ServiceName} failed", serviceName);
            return new
            {
                status = "unhealthy",
                latencyMs = sw.ElapsedMilliseconds,
                components = new Dictionary<string, object>
                {
                    ["error"] = new { status = "unhealthy", error = ex.Message },
                },
            };
        }
    }

    /// <summary>
    /// Maps a gRPC CheckHealthResponse to the gateway's anonymous response shape.
    /// </summary>
    private static object MapGrpcHealthResponse(CheckHealthResponse response, long latencyMs)
    {
        var components = new Dictionary<string, object>();
        foreach (var (key, comp) in response.Components)
        {
            components[key] = new
            {
                status = comp.Status,
                latencyMs = comp.LatencyMs,
                error = string.IsNullOrEmpty(comp.Error) ? null : comp.Error,
            };
        }

        return new
        {
            status = response.Status,
            latencyMs,
            components,
        };
    }

    /// <summary>
    /// Calls the Auth service's /health-rich HTTP endpoint.
    /// Auth is HTTP-only (no gRPC server).
    /// </summary>
    private static async Task<object> CheckAuthServiceAsync(
        IHttpClientFactory factory,
        CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var client = factory.CreateClient("health-auth");
            if (client.BaseAddress is null)
            {
                Log.Warning("Health client auth has no base address configured");
                return new
                {
                    status = "not configured",
                    latencyMs = 0L,
                    components = new Dictionary<string, object>(),
                };
            }

            var response = await client.GetAsync("/health-rich", ct);
            sw.Stop();

            if (response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
                return new
                {
                    status = body.TryGetProperty("status", out var s) ? s.GetString() : "healthy",
                    latencyMs = sw.ElapsedMilliseconds,
                    components = body.TryGetProperty("components", out var c)
                        ? c.Deserialize<Dictionary<string, object>>(sr_jsonOptions) ?? new()
                        : new Dictionary<string, object>(),
                };
            }

            var errorBody = await response.Content.ReadAsStringAsync(ct);

            // Try to parse as JSON to get component details even on 503.
            try
            {
                var body = JsonSerializer.Deserialize<JsonElement>(errorBody);
                return new
                {
                    status = body.TryGetProperty("status", out var s) ? s.GetString() : "unhealthy",
                    latencyMs = sw.ElapsedMilliseconds,
                    components = body.TryGetProperty("components", out var c)
                        ? c.Deserialize<Dictionary<string, object>>(sr_jsonOptions) ?? new()
                        : new Dictionary<string, object>(),
                };
            }
            catch
            {
                return new
                {
                    status = "unhealthy",
                    latencyMs = sw.ElapsedMilliseconds,
                    components = new Dictionary<string, object>
                    {
                        ["error"] = new { status = "unhealthy", error = $"HTTP {(int)response.StatusCode}" },
                    },
                };
            }
        }
        catch (Exception ex)
        {
            sw.Stop();
            Log.Warning(ex, "Health check to auth failed");
            return new
            {
                status = "unhealthy",
                latencyMs = sw.ElapsedMilliseconds,
                components = new Dictionary<string, object>
                {
                    ["error"] = new { status = "unhealthy", error = ex.Message },
                },
            };
        }
    }

    /// <summary>
    /// Checks the gateway's own cache health via the ping handler.
    /// </summary>
    private static async Task<(string Status, long LatencyMs, string? Error)> CheckGatewayCacheAsync(
        IRead.IPingHandler handler,
        CancellationToken ct)
    {
        var result = await handler.HandleAsync(new IRead.PingInput(), ct);
        if (result.Data is not null)
        {
            return (
                result.Data.Healthy ? "healthy" : "unhealthy",
                result.Data.LatencyMs,
                result.Data.Error);
        }

        return ("unhealthy", 0, "Ping handler returned no data");
    }

    /// <summary>
    /// Extracts the status string from an anonymous service result object.
    /// </summary>
    private static string GetStatus(object serviceResult)
    {
        var json = JsonSerializer.Serialize(serviceResult, sr_jsonOptions);
        var element = JsonSerializer.Deserialize<JsonElement>(json);
        return element.TryGetProperty("status", out var s) ? s.GetString() ?? "unknown" : "unknown";
    }

    /// <summary>
    /// Checks whether a service response object has a "healthy" status.
    /// </summary>
    private static bool HasHealthyStatus(object serviceResult) =>
        GetStatus(serviceResult) == "healthy";
}
