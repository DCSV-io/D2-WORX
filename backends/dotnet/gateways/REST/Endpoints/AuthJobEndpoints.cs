// -----------------------------------------------------------------------
// <copyright file="AuthJobEndpoints.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Gateways.REST.Endpoints;

using D2.Gateways.REST.Auth;
using D2.Services.Protos.Auth.V1;
using D2.Services.Protos.Common.V1;
using D2.Shared.Utilities.Extensions;

/// <summary>
/// Defines the Auth scheduled job REST endpoints.
/// Each endpoint proxies to the Auth gRPC AuthJobService.
/// </summary>
public static class AuthJobEndpoints
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
        /// Adds a gRPC client for the Auth job service to the service collection.
        /// Uses the auth-grpc Aspire endpoint with API key call credentials.
        /// </summary>
        ///
        /// <param name="configuration">
        /// The application configuration.
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddAuthJobsGrpcClient(IConfiguration configuration)
        {
            const string config_key = "services:d2-auth:auth-grpc:0";
            var authGrpcAddress = configuration[config_key];
            if (authGrpcAddress.Falsey())
            {
                throw new ArgumentException(
                    $"Auth gRPC service address not configured. Missing '{config_key}' configuration.");
            }

            var apiKey = configuration["GATEWAY_AUTH_GRPC_API_KEY"];
            if (apiKey.Falsey())
            {
                throw new ArgumentException(
                    "Auth gRPC API key not configured. Missing 'GATEWAY_AUTH_GRPC_API_KEY' configuration.");
            }

            services.AddGrpcClient<AuthJobService.AuthJobServiceClient>(o =>
            {
                o.Address = new Uri(authGrpcAddress!);
            })
            .AddCallCredentials((context, metadata) =>
            {
                metadata.Add("x-api-key", apiKey!);
                return Task.CompletedTask;
            })
            .ConfigureChannel(o => o.UnsafeUseInsecureChannelCallCredentials = true);

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
        /// Maps the Auth scheduled job REST API endpoints.
        /// All endpoints require a service key (Dkron/internal callers only).
        /// </summary>
        ///
        /// <returns>
        /// The updated endpoint route builder.
        /// </returns>
        public IEndpointRouteBuilder MapAuthJobEndpointsV1()
        {
            var group = erb.MapGroup("/api/v1/auth/jobs");

            group.MapPost("/purge-sessions", PurgeExpiredSessionsAsync)
                .RequireServiceKey()
                .WithName("PurgeExpiredSessions")
                .WithSummary("Purges expired auth sessions.");

            group.MapPost("/purge-sign-in-events", PurgeSignInEventsAsync)
                .RequireServiceKey()
                .WithName("PurgeSignInEvents")
                .WithSummary("Purges old sign-in events beyond retention period.");

            group.MapPost("/cleanup-invitations", CleanupExpiredInvitationsAsync)
                .RequireServiceKey()
                .WithName("CleanupExpiredInvitations")
                .WithSummary("Cleans up expired org invitations.");

            group.MapPost("/cleanup-emulation-consents", CleanupExpiredEmulationConsentsAsync)
                .RequireServiceKey()
                .WithName("CleanupExpiredEmulationConsents")
                .WithSummary("Cleans up expired or revoked emulation consents.");

            return erb;
        }
    }

    private static async Task<IResult> PurgeExpiredSessionsAsync(
        AuthJobService.AuthJobServiceClient client,
        CancellationToken ct)
    {
        var response = await client.PurgeExpiredSessionsAsync(
            new TriggerJobRequest(),
            cancellationToken: ct);

        return response.Result.ToHttpResult(response.Data);
    }

    private static async Task<IResult> PurgeSignInEventsAsync(
        AuthJobService.AuthJobServiceClient client,
        CancellationToken ct)
    {
        var response = await client.PurgeSignInEventsAsync(
            new TriggerJobRequest(),
            cancellationToken: ct);

        return response.Result.ToHttpResult(response.Data);
    }

    private static async Task<IResult> CleanupExpiredInvitationsAsync(
        AuthJobService.AuthJobServiceClient client,
        CancellationToken ct)
    {
        var response = await client.CleanupExpiredInvitationsAsync(
            new TriggerJobRequest(),
            cancellationToken: ct);

        return response.Result.ToHttpResult(response.Data);
    }

    private static async Task<IResult> CleanupExpiredEmulationConsentsAsync(
        AuthJobService.AuthJobServiceClient client,
        CancellationToken ct)
    {
        var response = await client.CleanupExpiredEmulationConsentsAsync(
            new TriggerJobRequest(),
            cancellationToken: ct);

        return response.Result.ToHttpResult(response.Data);
    }
}
