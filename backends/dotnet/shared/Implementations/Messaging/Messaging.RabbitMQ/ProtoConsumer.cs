// -----------------------------------------------------------------------
// <copyright file="ProtoConsumer.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Messaging.RabbitMQ;

using System.Text;
using global::RabbitMQ.Client;
using global::RabbitMQ.Client.Events;
using Google.Protobuf;
using Microsoft.Extensions.Logging;

/// <summary>
/// Consumes protobuf messages (JSON-encoded) from a RabbitMQ queue.
/// </summary>
///
/// <typeparam name="T">
/// The protobuf message type.
/// </typeparam>
public sealed class ProtoConsumer<T> : IAsyncDisposable
    where T : IMessage<T>, new()
{
    private readonly IChannel r_channel;
    private readonly ILogger r_logger;
    private readonly string r_consumerTag;

    private ProtoConsumer(IChannel channel, ILogger logger, string consumerTag)
    {
        r_channel = channel;
        r_logger = logger;
        r_consumerTag = consumerTag;
    }

    /// <summary>
    /// Creates a broadcast consumer that receives all messages from a fanout exchange.
    /// Each instance gets its own exclusive auto-delete queue.
    /// </summary>
    ///
    /// <param name="connection">
    /// The RabbitMQ connection.
    /// </param>
    /// <param name="exchange">
    /// The fanout exchange name.
    /// </param>
    /// <param name="instanceId">
    /// A short identifier for this consumer instance (used in queue name).
    /// </param>
    /// <param name="handler">
    /// The message handler delegate.
    /// </param>
    /// <param name="logger">
    /// The logger.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A configured <see cref="ProtoConsumer{T}"/> that is actively consuming.
    /// </returns>
    public static async Task<ProtoConsumer<T>> CreateBroadcastAsync(
        IConnection connection,
        string exchange,
        string instanceId,
        Func<T, CancellationToken, Task> handler,
        ILogger logger,
        CancellationToken ct = default)
    {
        var channel = await connection.CreateChannelAsync(cancellationToken: ct);

        // Declare the fanout exchange (idempotent).
        await channel.ExchangeDeclareAsync(
            exchange: exchange,
            type: ExchangeType.Fanout,
            durable: true,
            autoDelete: false,
            cancellationToken: ct);

        // Declare an exclusive auto-delete queue for this instance.
        var queueName = $"{exchange}.{instanceId}";
        await channel.QueueDeclareAsync(
            queue: queueName,
            durable: false,
            exclusive: true,
            autoDelete: true,
            cancellationToken: ct);

        await channel.QueueBindAsync(
            queue: queueName,
            exchange: exchange,
            routingKey: string.Empty,
            cancellationToken: ct);

        // Set prefetch to 1 to avoid overwhelming the handler.
        await channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false, cancellationToken: ct);

        var consumer = new AsyncEventingBasicConsumer(channel);

        consumer.ReceivedAsync += async (_, ea) =>
        {
            try
            {
                var json = Encoding.UTF8.GetString(ea.Body.Span);
                var message = JsonParser.Default.Parse<T>(json);

                await handler(message, ct);

                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false, cancellationToken: ct);
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Failed to process {ProtoType} message, requeueing",
                    typeof(T).Name);

                await channel.BasicNackAsync(
                    ea.DeliveryTag,
                    multiple: false,
                    requeue: true,
                    cancellationToken: ct);
            }
        };

        var consumerTag = await channel.BasicConsumeAsync(
            queue: queueName,
            autoAck: false,
            consumer: consumer,
            cancellationToken: ct);

        logger.LogInformation(
            "Started broadcast consumer for {ProtoType} on exchange {Exchange} (queue: {Queue})",
            typeof(T).Name,
            exchange,
            queueName);

        return new ProtoConsumer<T>(channel, logger, consumerTag);
    }

    /// <summary>
    /// Stops consuming and disposes the channel.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> representing the asynchronous dispose operation.
    /// </returns>
    public async ValueTask DisposeAsync()
    {
        try
        {
            await r_channel.BasicCancelAsync(r_consumerTag);
        }
        catch (Exception ex)
        {
            r_logger.LogWarning(ex, "Error cancelling consumer {Tag}", r_consumerTag);
        }

        await r_channel.DisposeAsync();
    }
}
