// -----------------------------------------------------------------------
// <copyright file="ProtoPublisher.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Messaging.RabbitMQ;

using System.Text;
using global::RabbitMQ.Client;
using Google.Protobuf;
using Microsoft.Extensions.Logging;

/// <summary>
/// Publishes protobuf messages as JSON to RabbitMQ exchanges.
/// </summary>
public class ProtoPublisher
{
    private readonly IConnection r_connection;
    private readonly ILogger<ProtoPublisher> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="ProtoPublisher"/> class.
    /// </summary>
    ///
    /// <param name="connection">
    /// The RabbitMQ connection.
    /// </param>
    /// <param name="logger">
    /// The logger.
    /// </param>
    public ProtoPublisher(
        IConnection connection,
        ILogger<ProtoPublisher> logger)
    {
        r_connection = connection;
        r_logger = logger;
    }

    /// <summary>
    /// Publishes a protobuf message as JSON to the specified exchange.
    /// </summary>
    ///
    /// <typeparam name="T">
    /// The protobuf message type.
    /// </typeparam>
    /// <param name="exchange">
    /// The target exchange name.
    /// </param>
    /// <param name="message">
    /// The protobuf message to publish.
    /// </param>
    /// <param name="routingKey">
    /// The routing key (empty string for fanout exchanges).
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    public virtual async Task PublishAsync<T>(
        string exchange,
        T message,
        string routingKey = "",
        CancellationToken ct = default)
        where T : IMessage<T>
    {
        await using var channel = await r_connection.CreateChannelAsync(cancellationToken: ct);

        await channel.ExchangeDeclareAsync(
            exchange: exchange,
            type: ExchangeType.Fanout,
            durable: true,
            autoDelete: false,
            cancellationToken: ct);

        var json = JsonFormatter.Default.Format(message);
        var body = Encoding.UTF8.GetBytes(json);

        var properties = new BasicProperties
        {
            ContentType = "application/json",
            MessageId = Guid.NewGuid().ToString("N"),
            Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds()),
        };
        properties.Headers = new Dictionary<string, object?>
        {
            ["x-proto-type"] = message.Descriptor.FullName,
        };

        await channel.BasicPublishAsync(
            exchange: exchange,
            routingKey: routingKey,
            mandatory: false,
            basicProperties: properties,
            body: body,
            cancellationToken: ct);

        r_logger.LogDebug(
            "Published {ProtoType} to exchange {Exchange}",
            message.Descriptor.FullName,
            exchange);
    }
}
