// -----------------------------------------------------------------------
// <copyright file="MessageBus.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Messaging.RabbitMQ;

using System.Text;
using D2.Shared.Interfaces.Messaging;
using global::RabbitMQ.Client;
using global::RabbitMQ.Client.Events;
using Google.Protobuf;
using Microsoft.Extensions.Logging;

/// <summary>
/// RabbitMQ implementation of <see cref="IMessageBus"/>.
/// Wraps <see cref="ProtoPublisher"/> for publishing and creates managed consumers
/// for subscribing. Consumers NACK without requeue on failure (no poison message loops).
/// </summary>
public sealed class MessageBus : IMessageBus
{
    private readonly IConnection r_connection;
    private readonly ProtoPublisher r_publisher;
    private readonly ILogger<MessageBus> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="MessageBus"/> class.
    /// </summary>
    ///
    /// <param name="connection">
    /// The RabbitMQ connection.
    /// </param>
    /// <param name="publisher">
    /// The existing proto publisher for publishing messages.
    /// </param>
    /// <param name="logger">
    /// The logger.
    /// </param>
    public MessageBus(
        IConnection connection,
        ProtoPublisher publisher,
        ILogger<MessageBus> logger)
    {
        r_connection = connection;
        r_publisher = publisher;
        r_logger = logger;
    }

    /// <inheritdoc/>
    public async Task<IAsyncDisposable> SubscribeAsync<T>(
        ConsumerConfig config,
        Func<IncomingMessage<T>, CancellationToken, Task<ConsumerResult>> handler,
        CancellationToken ct = default)
        where T : IMessage<T>, new()
    {
        var channel = await r_connection.CreateChannelAsync(cancellationToken: ct);

        // Declare the fanout exchange (idempotent).
        await channel.ExchangeDeclareAsync(
            exchange: config.Exchange,
            type: ExchangeType.Fanout,
            durable: true,
            autoDelete: false,
            cancellationToken: ct);

        // Declare queue based on broadcast mode.
        string queueName;
        if (config.Broadcast)
        {
            queueName = $"{config.Exchange}.{config.InstanceId}";
            await channel.QueueDeclareAsync(
                queue: queueName,
                durable: false,
                exclusive: true,
                autoDelete: true,
                cancellationToken: ct);
        }
        else
        {
            queueName = $"{config.Exchange}.shared";
            await channel.QueueDeclareAsync(
                queue: queueName,
                durable: true,
                exclusive: false,
                autoDelete: false,
                cancellationToken: ct);
        }

        await channel.QueueBindAsync(
            queue: queueName,
            exchange: config.Exchange,
            routingKey: string.Empty,
            cancellationToken: ct);

        // Set configurable prefetch count.
        await channel.BasicQosAsync(
            prefetchSize: 0,
            prefetchCount: config.PrefetchCount,
            global: false,
            cancellationToken: ct);

        var consumer = new AsyncEventingBasicConsumer(channel);

        consumer.ReceivedAsync += async (_, ea) =>
        {
            ConsumerResult result;
            try
            {
                var json = Encoding.UTF8.GetString(ea.Body.Span);
                var body = JsonParser.Default.Parse<T>(json);

                var headers = ea.BasicProperties.Headers
                    ?? new Dictionary<string, object?>();
                var incoming = new IncomingMessage<T>(
                    body,
                    headers,
                    ea.BasicProperties.MessageId,
                    ea.BasicProperties.CorrelationId,
                    ea.Redelivered);

                result = await handler(incoming, ct);
            }
            catch (Exception ex)
            {
                r_logger.LogError(
                    ex,
                    "Exception processing {ProtoType} message, dropping (NACK requeue=false)",
                    typeof(T).Name);
                result = ConsumerResult.Drop;
            }

            switch (result)
            {
                case ConsumerResult.Ack:
                    await channel.BasicAckAsync(
                        ea.DeliveryTag, multiple: false, cancellationToken: ct);
                    break;
                case ConsumerResult.Drop:
                default:
                    await channel.BasicNackAsync(
                        ea.DeliveryTag, multiple: false, requeue: false, cancellationToken: ct);
                    break;
            }
        };

        var consumerTag = await channel.BasicConsumeAsync(
            queue: queueName,
            autoAck: false,
            consumer: consumer,
            cancellationToken: ct);

        r_logger.LogInformation(
            "Started {ProtoType} consumer on exchange {Exchange} (queue: {Queue}, prefetch: {Prefetch})",
            typeof(T).Name,
            config.Exchange,
            queueName,
            config.PrefetchCount);

        return new Subscription(channel, consumerTag, r_logger);
    }

    /// <inheritdoc/>
    public Task PublishAsync<T>(
        string exchange,
        T message,
        string routingKey = "",
        CancellationToken ct = default)
        where T : IMessage<T>
    {
        return r_publisher.PublishAsync(exchange, message, routingKey, ct);
    }

    /// <inheritdoc/>
    public Task<bool> PingAsync(CancellationToken ct = default)
    {
        return Task.FromResult(r_connection.IsOpen);
    }

    /// <summary>
    /// Represents an active subscription that can be disposed to stop consuming.
    /// </summary>
    private sealed class Subscription : IAsyncDisposable
    {
        private readonly IChannel r_channel;
        private readonly string r_consumerTag;
        private readonly ILogger r_logger;

        public Subscription(IChannel channel, string consumerTag, ILogger logger)
        {
            r_channel = channel;
            r_consumerTag = consumerTag;
            r_logger = logger;
        }

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
}
