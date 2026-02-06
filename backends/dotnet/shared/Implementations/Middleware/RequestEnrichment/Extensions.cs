// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment;

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Extension methods for adding request enrichment services and middleware.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds request enrichment services to the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds request enrichment services to the service collection.
        /// </summary>
        ///
        /// <param name="configuration">
        /// The configuration to read options from.
        /// </param>
        /// <param name="sectionName">
        /// The configuration section name for options. Defaults to "RequestEnrichmentOptions".
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddRequestEnrichment(
            IConfiguration configuration,
            string sectionName = nameof(RequestEnrichmentOptions))
        {
            services.Configure<RequestEnrichmentOptions>(configuration.GetSection(sectionName));

            return services;
        }
    }

    /// <summary>
    /// Adds request enrichment middleware to the application pipeline.
    /// </summary>
    ///
    /// <param name="app">
    /// The application builder.
    /// </param>
    extension(IApplicationBuilder app)
    {
        /// <summary>
        /// Adds request enrichment middleware to the application pipeline.
        /// </summary>
        ///
        /// <returns>
        /// The application builder for chaining.
        /// </returns>
        /// <remarks>
        /// This middleware should be placed after exception handling and logging,
        /// but before rate limiting and authentication middleware.
        /// </remarks>
        public IApplicationBuilder UseRequestEnrichment()
        {
            app.UseMiddleware<RequestEnrichmentMiddleware>();

            return app;
        }
    }
}
