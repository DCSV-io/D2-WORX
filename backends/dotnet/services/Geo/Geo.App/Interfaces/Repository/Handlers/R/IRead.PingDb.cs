// -----------------------------------------------------------------------
// <copyright file="IRead.PingDb.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.Repository.Handlers.R;

using D2.Shared.Handler;

public partial interface IRead
{
    /// <summary>
    /// Handler for pinging the database to verify connectivity.
    /// </summary>
    public interface IPingDbHandler : IHandler<PingDbInput, PingDbOutput>;

    /// <summary>
    /// Input for pinging the database.
    /// </summary>
    public record PingDbInput;

    /// <summary>
    /// Output for pinging the database.
    /// </summary>
    ///
    /// <param name="Healthy">
    /// Whether the database is reachable.
    /// </param>
    /// <param name="LatencyMs">
    /// The round-trip latency in milliseconds.
    /// </param>
    /// <param name="Error">
    /// An error message if the ping failed, null otherwise.
    /// </param>
    public record PingDbOutput(bool Healthy, long LatencyMs, string? Error);
}
