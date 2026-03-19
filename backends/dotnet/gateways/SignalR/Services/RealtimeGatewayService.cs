// -----------------------------------------------------------------------
// <copyright file="RealtimeGatewayService.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Gateways.SignalR.Services;

using D2.Gateways.Protos.Realtime.V1;
using D2.Gateways.SignalR.Hubs;
using D2.Gateways.SignalR.Interceptors;
using D2.Services.Protos.Common.V1;
using Grpc.Core;
using Microsoft.AspNetCore.SignalR;

/// <summary>
/// gRPC service implementation for the RealtimeGateway.
/// Routes push requests from internal services to SignalR Groups (channels).
/// </summary>
public partial class RealtimeGatewayService : RealtimeGateway.RealtimeGatewayBase
{
    private readonly IHubContext<AuthenticatedHub> r_hubContext;
    private readonly ILogger<RealtimeGatewayService> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="RealtimeGatewayService"/> class.
    /// </summary>
    /// <param name="hubContext">The SignalR hub context for sending messages.</param>
    /// <param name="logger">The logger.</param>
    public RealtimeGatewayService(
        IHubContext<AuthenticatedHub> hubContext,
        ILogger<RealtimeGatewayService> logger)
    {
        r_hubContext = hubContext;
        r_logger = logger;
    }

    /// <summary>
    /// Pushes an event to all connections subscribed to the specified channel.
    /// </summary>
    /// <param name="request">The push request with channel, event, and payload.</param>
    /// <param name="context">The gRPC server call context.</param>
    /// <returns>A push response indicating delivery status.</returns>
    [RequiresServiceKey]
    public override async Task<PushResponse> PushToChannel(
        PushToChannelRequest request,
        ServerCallContext context)
    {
        await r_hubContext.Clients
            .Group(request.Channel)
            .SendAsync("ReceiveEvent", request.Event, request.PayloadJson, context.CancellationToken);

        LogPushedEvent(r_logger, request.Event, request.Channel);

        return new PushResponse
        {
            Result = new D2ResultProto { Success = true, StatusCode = 200 },
            Delivered = true,
        };
    }

    /// <summary>
    /// Removes a specific connection from a channel group.
    /// Used when a service revokes access (e.g., user removed from thread).
    /// </summary>
    /// <param name="request">The removal request with channel and connection ID.</param>
    /// <param name="context">The gRPC server call context.</param>
    /// <returns>A push response confirming the removal.</returns>
    [RequiresServiceKey]
    public override async Task<PushResponse> RemoveFromChannel(
        RemoveFromChannelRequest request,
        ServerCallContext context)
    {
        await r_hubContext.Groups.RemoveFromGroupAsync(
            request.ConnectionId,
            request.Channel,
            context.CancellationToken);

        LogRemovedFromChannel(r_logger, request.ConnectionId, request.Channel);

        return new PushResponse
        {
            Result = new D2ResultProto { Success = true, StatusCode = 200 },
            Delivered = true,
        };
    }

    /// <summary>
    /// Health check — reports gateway status.
    /// </summary>
    /// <param name="request">The health check request.</param>
    /// <param name="context">The gRPC server call context.</param>
    /// <returns>The health check response.</returns>
    public override Task<CheckHealthResponse> CheckHealth(
        CheckHealthRequest request,
        ServerCallContext context)
    {
        var response = new CheckHealthResponse
        {
            Status = "healthy",
            Timestamp = DateTime.UtcNow.ToString("o"),
        };

        return Task.FromResult(response);
    }

    [LoggerMessage(Level = LogLevel.Debug, Message = "Pushed event {Event} to channel {Channel}")]
    private static partial void LogPushedEvent(ILogger logger, string @event, string channel);

    [LoggerMessage(Level = LogLevel.Information, Message = "Removed connection {ConnectionId} from channel {Channel}")]
    private static partial void LogRemovedFromChannel(ILogger logger, string connectionId, string channel);
}
