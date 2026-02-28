// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Idempotency.Default;

using D2.Shared.Idempotency.Default.Handlers.X;
using D2.Shared.Idempotency.Default.Interfaces;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Extension methods for adding idempotency services and middleware.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds idempotency services to the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds idempotency services to the service collection.
        /// </summary>
        ///
        /// <param name="configuration">
        /// The configuration to read options from.
        /// </param>
        /// <param name="sectionName">
        /// The configuration section name for options. Defaults to "GATEWAY_IDEMPOTENCY".
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        /// <remarks>
        /// Requires distributed caching services to be registered (e.g., via AddRedisCaching).
        /// </remarks>
        public IServiceCollection AddIdempotency(
            IConfiguration configuration,
            string sectionName = "GATEWAY_IDEMPOTENCY")
        {
            services.Configure<IdempotencyOptions>(configuration.GetSection(sectionName));
            services.AddTransient<IIdempotency.ICheckHandler, Check>();

            return services;
        }
    }

    /// <summary>
    /// Adds idempotency middleware to the application pipeline.
    /// </summary>
    ///
    /// <param name="app">
    /// The application builder.
    /// </param>
    extension(IApplicationBuilder app)
    {
        /// <summary>
        /// Adds idempotency middleware to the application pipeline.
        /// </summary>
        ///
        /// <returns>
        /// The application builder for chaining.
        /// </returns>
        /// <remarks>
        /// This middleware should be placed after authentication middleware and before endpoints.
        /// </remarks>
        public IApplicationBuilder UseIdempotency()
        {
            app.UseMiddleware<IdempotencyMiddleware>();

            return app;
        }
    }
}
