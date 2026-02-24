// -----------------------------------------------------------------------
// <copyright file="IRead.Ping.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Messaging.Handlers.Q;

using D2.Shared.Handler;

public partial interface IRead
{
    /// <summary>
    /// Handler for pinging the message bus to verify connectivity.
    /// </summary>
    public interface IPingHandler : IHandler<PingInput, PingOutput>;

    /// <summary>
    /// Input for pinging the message bus.
    /// </summary>
    public record PingInput;

    /// <summary>
    /// Output for pinging the message bus.
    /// </summary>
    ///
    /// <param name="Healthy">
    /// Whether the message bus is reachable.
    /// </param>
    /// <param name="LatencyMs">
    /// The round-trip latency in milliseconds.
    /// </param>
    /// <param name="Error">
    /// An error message if the ping failed, null otherwise.
    /// </param>
    public record PingOutput(bool Healthy, long LatencyMs, string? Error);
}
