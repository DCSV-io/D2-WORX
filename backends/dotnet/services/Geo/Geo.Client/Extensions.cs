// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client;

using D2.Geo.Client.CQRS.Handlers.C;
using D2.Geo.Client.CQRS.Handlers.Q;
using D2.Geo.Client.CQRS.Handlers.X;
using D2.Geo.Client.Interfaces.CQRS.Handlers.C;
using D2.Geo.Client.Interfaces.CQRS.Handlers.Q;
using D2.Geo.Client.Interfaces.CQRS.Handlers.X;
using D2.Geo.Client.Interfaces.Messaging.Handlers.Sub;
using D2.Geo.Client.Messaging.Handlers.Sub;
using D2.Services.Protos.Geo.V1;
using D2.Shared.InMemoryCache.Default;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Extension methods for adding GeoRefDataService handlers.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds GeoRefDataService handlers for consumer services.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds GeoRefDataService consumer handlers including gRPC client.
        /// </summary>
        ///
        /// <param name="configuration">
        /// The configuration containing the Geo service URL.
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddGeoRefDataConsumer(IConfiguration configuration)
        {
            services.AddGrpcClient<GeoService.GeoServiceClient>(o =>
            {
                o.Address = new Uri(configuration["GeoService:Url"] ?? "http://geo-service");
            });

            services.AddTransient<IComplex.IGetHandler, Get>();
            services.AddTransient<ICommands.IReqUpdateHandler, ReqUpdate>();
            services.AddGeoRefDataShared();

            return services;
        }

        /// <summary>
        /// Adds GeoRefDataService provider handlers (for Geo service itself).
        /// </summary>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddGeoRefDataProvider()
        {
            services.AddTransient<ICommands.ISetInDistHandler, SetInDist>();
            services.AddGeoRefDataShared();

            return services;
        }

        /// <summary>
        /// Adds shared GeoRefDataService handlers used by both consumer and provider.
        /// </summary>
        private void AddGeoRefDataShared()
        {
            services.AddTransient<IQueries.IGetFromMemHandler, GetFromMem>();
            services.AddTransient<IQueries.IGetFromDistHandler, GetFromDist>();
            services.AddTransient<IQueries.IGetFromDiskHandler, GetFromDisk>();
            services.AddTransient<ICommands.ISetInMemHandler, SetInMem>();
            services.AddTransient<ICommands.ISetOnDiskHandler, SetOnDisk>();
            services.AddTransient<ISubs.IUpdatedHandler, Updated>();
        }

        /// <summary>
        /// Adds WhoIs caching services with local memory cache and gRPC fallback.
        /// </summary>
        ///
        /// <param name="configuration">
        /// The configuration to read options from.
        /// </param>
        /// <param name="servicePrefix">
        /// Optional service prefix for layered configuration. When provided,
        /// shared defaults from <c>GeoClientOptions</c> are bound first, then
        /// service-specific overrides from <c>{prefix}GeoClientOptions</c> are
        /// overlaid. For example, <c>"Auth"</c> reads from <c>AuthGeoClientOptions</c>.
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        /// <remarks>
        /// This method requires a gRPC client for <see cref="GeoService.GeoServiceClient"/>
        /// to be registered (e.g., via <see cref="AddGeoRefDataConsumer"/> or manually).
        /// </remarks>
        public IServiceCollection AddWhoIsCache(
            IConfiguration configuration,
            string? servicePrefix = null)
        {
            services.ConfigureGeoClientOptions(configuration, servicePrefix);
            services.AddDefaultMemoryCaching();
            services.AddTransient<IComplex.IFindWhoIsHandler, FindWhoIs>();

            return services;
        }

        /// <summary>
        /// Adds contact handler services with local memory cache and gRPC calls.
        /// </summary>
        ///
        /// <param name="configuration">
        /// The configuration to read options from.
        /// </param>
        /// <param name="servicePrefix">
        /// Optional service prefix for layered configuration. When provided,
        /// shared defaults from <c>GeoClientOptions</c> are bound first, then
        /// service-specific overrides from <c>{prefix}GeoClientOptions</c> are
        /// overlaid. For example, <c>"Auth"</c> reads from <c>AuthGeoClientOptions</c>.
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        /// <remarks>
        /// This method requires a gRPC client for <see cref="GeoService.GeoServiceClient"/>
        /// to be registered (e.g., via <see cref="AddGeoRefDataConsumer"/> or manually).
        /// </remarks>
        public IServiceCollection AddContactHandlers(
            IConfiguration configuration,
            string? servicePrefix = null)
        {
            services.ConfigureGeoClientOptions(configuration, servicePrefix);
            services.AddDefaultMemoryCaching();
            services.AddTransient<ICommands.ICreateContactsHandler, CreateContacts>();
            services.AddTransient<ICommands.IDeleteContactsByExtKeysHandler, DeleteContactsByExtKeys>();
            services.AddTransient<IQueries.IGetContactsByExtKeysHandler, GetContactsByExtKeys>();
            services.AddTransient<IComplex.IUpdateContactsByExtKeysHandler, UpdateContactsByExtKeys>();

            return services;
        }

        /// <summary>
        /// Binds <see cref="GeoClientOptions"/> using a layered approach: shared defaults
        /// first, then service-specific overrides on top.
        /// </summary>
        private void ConfigureGeoClientOptions(
            IConfiguration configuration,
            string? servicePrefix)
        {
            const string baseSectionName = nameof(GeoClientOptions);

            // Always bind shared defaults.
            services.Configure<GeoClientOptions>(configuration.GetSection(baseSectionName));

            // Overlay service-specific overrides if prefix provided.
            if (!string.IsNullOrEmpty(servicePrefix))
            {
                services.Configure<GeoClientOptions>(
                    configuration.GetSection($"{servicePrefix}{baseSectionName}"));
            }
        }
    }
}
