// -----------------------------------------------------------------------
// <copyright file="AmqpConventions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Messaging.RabbitMQ.Conventions;

/// <summary>
/// AMQP exchange and queue naming conventions for D2-WORX messaging.
/// </summary>
public static class AmqpConventions
{
    /// <summary>
    /// Returns the fanout exchange name for a service's events.
    /// </summary>
    ///
    /// <param name="service">
    /// The service name (e.g. "geo", "auth").
    /// </param>
    ///
    /// <returns>
    /// The exchange name (e.g. "events.geo").
    /// </returns>
    public static string EventExchange(string service) => $"events.{service}";

    /// <summary>
    /// Returns the topic exchange name for a service's commands.
    /// </summary>
    ///
    /// <param name="service">
    /// The service name (e.g. "geo", "auth").
    /// </param>
    ///
    /// <returns>
    /// The exchange name (e.g. "commands.geo").
    /// </returns>
    public static string CommandExchange(string service) => $"commands.{service}";
}
