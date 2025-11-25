// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra;

using D2.Contracts.GeoRefDataService.Default.Messaging.MT.Consumers;
using D2.Contracts.Transactions.Pg;
using D2.Geo.Infra.Repository;
using D2.Geo.Infra.Repository.Handlers.R;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Extension methods for adding Geo infrastructure services.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds Geo infrastructure handlers to the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds Geo infrastructure services to the service collection.
        /// </summary>
        ///
        /// <param name="dbConnectionString">
        /// The database connection string.
        /// </param>
        /// <param name="messageQueueConnectionString">
        /// The message queue connection string.
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddGeoInfra(
            string dbConnectionString,
            string messageQueueConnectionString)
        {
            // Database context.
            services.AddDbContext<GeoDbContext>(options => options.UseNpgsql(dbConnectionString));

            // Add support for transactions.
            services.AddPgTransactions();

            // Repository (read) handlers.
            services.AddTransient<App.Interfaces.Repository.Handlers.R.IRead.IGetReferenceDataHandler, GetReferenceData>();

            // Configure MassTransit with RabbitMQ.
            services.AddMassTransit(x =>
            {
                // Add geographic reference data updated consumer.
                x.AddConsumer<UpdatedConsumer>();

                // Configure RabbitMQ as the transport.
                x.UsingRabbitMq((context, cfg) =>
                {
                    cfg.Host(messageQueueConnectionString);
                    cfg.ConfigureEndpoints(context);
                });
            });

            return services;
        }
    }
}
