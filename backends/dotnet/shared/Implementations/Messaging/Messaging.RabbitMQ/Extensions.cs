// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Messaging.RabbitMQ;

using D2.Shared.Interfaces.Messaging;
using global::RabbitMQ.Client;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Extension methods for adding RabbitMQ messaging services.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds RabbitMQ messaging services to the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds RabbitMQ messaging services including a shared connection and proto publisher.
        /// </summary>
        ///
        /// <param name="connectionString">
        /// The RabbitMQ connection string (AMQP URI).
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddRabbitMqMessaging(string connectionString)
        {
            services.AddSingleton<IConnection>(sp =>
            {
                var factory = new ConnectionFactory
                {
                    Uri = new Uri(connectionString),
                };

                // RabbitMQ.Client v7 — async connection.
                return factory.CreateConnectionAsync().GetAwaiter().GetResult();
            });

            services.AddSingleton<ProtoPublisher>();
            services.AddSingleton<IMessageBus, MessageBus>();

            services.AddTransient<
                Interfaces.Messaging.Handlers.Q.IRead.IPingHandler,
                Handlers.Q.Ping>();

            return services;
        }
    }
}
