// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RateLimit.Redis;

using D2.Shared.RateLimit.Redis.Handlers;
using D2.Shared.RateLimit.Redis.Interfaces;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

/// <summary>
/// Extension methods for adding rate limiting services and middleware.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds rate limiting services to the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds rate limiting services to the service collection.
        /// </summary>
        ///
        /// <param name="redisConnectionString">
        /// The Redis connection string.
        /// </param>
        /// <param name="configuration">
        /// The configuration to read options from.
        /// </param>
        /// <param name="sectionName">
        /// The configuration section name for options. Defaults to "RateLimitOptions".
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddRateLimiting(
            string redisConnectionString,
            IConfiguration configuration,
            string sectionName = nameof(RateLimitOptions))
        {
            services.Configure<RateLimitOptions>(configuration.GetSection(sectionName));

            services.AddSingleton<IConnectionMultiplexer>(
                ConnectionMultiplexer.Connect(redisConnectionString));

            services.AddTransient<IRateLimit.ICheckHandler, Check>();

            return services;
        }
    }

    /// <summary>
    /// Adds rate limiting middleware to the application pipeline.
    /// </summary>
    ///
    /// <param name="app">
    /// The application builder.
    /// </param>
    extension(IApplicationBuilder app)
    {
        /// <summary>
        /// Adds rate limiting middleware to the application pipeline.
        /// </summary>
        ///
        /// <returns>
        /// The application builder for chaining.
        /// </returns>
        /// <remarks>
        /// This middleware should be placed after request enrichment middleware
        /// and before authentication middleware.
        /// </remarks>
        public IApplicationBuilder UseRateLimiting()
        {
            app.UseMiddleware<RateLimitMiddleware>();

            return app;
        }
    }
}
