// -----------------------------------------------------------------------
// <copyright file="ConsumerConfig.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Messaging;

/// <summary>
/// Configuration for a message consumer subscription.
/// </summary>
public record ConsumerConfig
{
    /// <summary>
    /// Gets the exchange to consume from.
    /// </summary>
    public required string Exchange { get; init; }

    /// <summary>
    /// Gets a short identifier for this consumer instance (used in queue naming).
    /// </summary>
    public required string InstanceId { get; init; }

    /// <summary>
    /// Gets the prefetch count (number of unacknowledged messages the broker delivers).
    /// </summary>
    /// <value>Defaults to 1.</value>
    public ushort PrefetchCount { get; init; } = 1;

    /// <summary>
    /// Gets a value indicating whether this is a broadcast consumer
    /// (exclusive auto-delete queue per instance).
    /// </summary>
    /// <value>Defaults to <c>true</c>.</value>
    public bool Broadcast { get; init; } = true;
}
