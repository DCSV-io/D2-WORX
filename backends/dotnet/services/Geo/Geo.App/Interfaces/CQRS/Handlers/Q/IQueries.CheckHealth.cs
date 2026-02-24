// -----------------------------------------------------------------------
// <copyright file="IQueries.CheckHealth.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.Q;

using D2.Shared.Handler;

public partial interface IQueries
{
    /// <summary>
    /// Handler for checking the overall health of the Geo service.
    /// </summary>
    public interface ICheckHealthHandler : IHandler<CheckHealthInput, CheckHealthOutput>;

    /// <summary>
    /// Input for checking service health.
    /// </summary>
    public record CheckHealthInput;

    /// <summary>
    /// Output for checking service health.
    /// </summary>
    ///
    /// <param name="Status">
    /// Overall status: "healthy" or "degraded".
    /// </param>
    /// <param name="Components">
    /// Per-component health status.
    /// </param>
    public record CheckHealthOutput(
        string Status,
        Dictionary<string, ComponentHealth> Components);

    /// <summary>
    /// Health status of an individual component.
    /// </summary>
    ///
    /// <param name="Status">
    /// Component status: "healthy" or "unhealthy".
    /// </param>
    /// <param name="LatencyMs">
    /// The check latency in milliseconds, if available.
    /// </param>
    /// <param name="Error">
    /// An error message if the check failed, null otherwise.
    /// </param>
    public record ComponentHealth(string Status, long? LatencyMs, string? Error);
}
