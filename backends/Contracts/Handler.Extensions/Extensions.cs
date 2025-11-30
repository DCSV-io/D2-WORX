// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Handler.Extensions;

using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Extension methods for registering handler context services.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Extension methods for <see cref="IServiceCollection"/>.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to extend.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds handler context services to the service collection including
        /// <see cref="IRequestContext"/> and <see cref="IHandlerContext"/>.
        /// </summary>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddHandlerContext()
        {
            services.AddHttpContextAccessor();
            services.AddScoped<IRequestContext, RequestContext>();
            services.AddScoped<IHandlerContext, HandlerContext>();

            return services;
        }
    }
}
