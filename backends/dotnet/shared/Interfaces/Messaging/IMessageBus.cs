// -----------------------------------------------------------------------
// <copyright file="IMessageBus.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Interfaces.Messaging;

using Google.Protobuf;

/// <summary>
/// Unified messaging abstraction for publishing and subscribing to protobuf messages.
/// Mirrors the Node.js <c>MessageBus</c> from <c>@d2/messaging</c>.
/// </summary>
public interface IMessageBus
{
    /// <summary>
    /// Subscribes to messages on the configured exchange.
    /// </summary>
    ///
    /// <typeparam name="T">
    /// The protobuf message type to consume.
    /// </typeparam>
    /// <param name="config">
    /// Consumer configuration (exchange, instance ID, prefetch count).
    /// </param>
    /// <param name="handler">
    /// The message handler delegate. Returns <see cref="ConsumerResult"/> to control ack/nack.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// An <see cref="IAsyncDisposable"/> that stops the consumer when disposed.
    /// </returns>
    Task<IAsyncDisposable> SubscribeAsync<T>(
        ConsumerConfig config,
        Func<IncomingMessage<T>, CancellationToken, Task<ConsumerResult>> handler,
        CancellationToken ct = default)
        where T : IMessage<T>, new();

    /// <summary>
    /// Publishes a protobuf message to the specified exchange.
    /// </summary>
    ///
    /// <typeparam name="T">
    /// The protobuf message type to publish.
    /// </typeparam>
    /// <param name="exchange">
    /// The target exchange name.
    /// </param>
    /// <param name="message">
    /// The message to publish.
    /// </param>
    /// <param name="routingKey">
    /// The routing key (empty string for fanout exchanges).
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous publish operation.
    /// </returns>
    Task PublishAsync<T>(
        string exchange,
        T message,
        string routingKey = "",
        CancellationToken ct = default)
        where T : IMessage<T>;

    /// <summary>
    /// Checks whether the underlying connection is open.
    /// </summary>
    ///
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// <c>true</c> if the connection is healthy; <c>false</c> otherwise.
    /// </returns>
    Task<bool> PingAsync(CancellationToken ct = default);
}
