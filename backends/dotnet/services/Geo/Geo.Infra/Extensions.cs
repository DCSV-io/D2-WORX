// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra;

using D2.Geo.Infra.Messaging.Handlers.Pub;
using D2.Geo.Infra.Messaging.Publishers;
using D2.Geo.Infra.Repository;
using D2.Geo.Infra.Repository.Handlers.C;
using D2.Geo.Infra.Repository.Handlers.D;
using D2.Geo.Infra.Repository.Handlers.R;
using D2.Shared.DistributedCache.Redis;
using D2.Shared.InMemoryCache.Default;
using D2.Shared.Messaging.RabbitMQ;
using D2.Shared.Transactions.Pg;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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
        /// <param name="configuration">
        /// The application configuration.
        /// </param>
        /// <param name="dbConnectionString">
        /// The database connection string.
        /// </param>
        /// <param name="distributedCacheConnectionString">
        /// The distributed cache connection string.
        /// </param>
        /// <param name="messageQueueConnectionString">
        /// The message queue connection string.
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddGeoInfra(
            IConfiguration configuration,
            string dbConnectionString,
            string distributedCacheConnectionString,
            string messageQueueConnectionString)
        {
            // Add configuration options.
            services.Configure<GeoInfraOptions>(configuration.GetSection(nameof(GeoInfraOptions)));

            // Database context.
            services.AddDbContext<GeoDbContext>(options => options.UseNpgsql(dbConnectionString));
            services.AddScoped<DbContext, GeoDbContext>();

            // Local in-memory cache.
            services.AddDefaultMemoryCaching();

            // Distributed cache.
            services.AddRedisCaching(distributedCacheConnectionString);

            // Add support for transactions.
            services.AddPgTransactions();

            // Repository (query) handlers.
            services.AddTransient<App.Interfaces.Repository.Handlers.Q.IRead.IPingDbHandler, Repository.Handlers.Q.PingDb>();

            // Repository (read) handlers.
            services.AddTransient<App.Interfaces.Repository.Handlers.R.IRead.IGetReferenceDataHandler, GetReferenceData>();
            services.AddTransient<App.Interfaces.Repository.Handlers.R.IRead.IGetLocationsByIdsHandler, GetLocationsByIds>();
            services.AddTransient<App.Interfaces.Repository.Handlers.R.IRead.IGetWhoIsByIdsHandler, GetWhoIsByIds>();
            services.AddTransient<App.Interfaces.Repository.Handlers.R.IRead.IGetContactsByIdsHandler, GetContactsByIds>();
            services.AddTransient<App.Interfaces.Repository.Handlers.R.IRead.IGetContactsByExtKeysHandler, GetContactsByExtKeys>();

            // WhoIs provider services.
            services.AddSingleton<App.Interfaces.WhoIs.IIpInfoClient, WhoIs.IpInfoClientWrapper>();

            // WhoIs provider (read) handlers.
            services.AddTransient<App.Interfaces.WhoIs.Handlers.R.IRead.IPopulateHandler, WhoIs.Handlers.R.Populate>();

            // Repository (create) handlers.
            services.AddTransient<App.Interfaces.Repository.Handlers.C.ICreate.ICreateLocationsHandler, CreateLocations>();
            services.AddTransient<App.Interfaces.Repository.Handlers.C.ICreate.ICreateWhoIsHandler, CreateWhoIs>();
            services.AddTransient<App.Interfaces.Repository.Handlers.C.ICreate.ICreateContactsHandler, CreateContacts>();

            // Repository (delete) handlers.
            services.AddTransient<App.Interfaces.Repository.Handlers.D.IDelete.IDeleteContactsHandler, DeleteContacts>();
            services.AddTransient<App.Interfaces.Repository.Handlers.D.IDelete.IDeleteContactsByExtKeysHandler, DeleteContactsByExtKeys>();

            // Messaging (publish) handlers.
            services.AddTransient<App.Interfaces.Messaging.Handlers.Pub.IPubs.IUpdateHandler, Update>();
            services.AddTransient<App.Interfaces.Messaging.Handlers.Pub.IPubs.IContactEvictionHandler, ContactEviction>();

            // RabbitMQ messaging (raw AMQP, proto-serialized).
            services.AddRabbitMqMessaging(messageQueueConnectionString);
            services.AddTransient<UpdatePublisher>();
            services.AddTransient<ContactEvictionPublisher>();

            return services;
        }
    }
}
