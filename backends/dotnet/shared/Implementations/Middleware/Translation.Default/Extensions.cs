// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Translation.Default;

using D2.Shared.I18n;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Extension methods for adding translation middleware services.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Extension methods for <see cref="IServiceCollection"/>.
    /// </summary>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Registers the <see cref="ITranslator"/> singleton by loading message catalogs
        /// from the <c>messages/</c> directory in the application base directory.
        /// </summary>
        ///
        /// <param name="configuration">
        /// The application configuration (reserved for future options).
        /// </param>
        /// <param name="sectionName">
        /// The configuration section name. Defaults to "GATEWAY_TRANSLATION".
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddTranslation(
            IConfiguration configuration,
            string sectionName = "GATEWAY_TRANSLATION")
        {
            var messagesDir = Path.Combine(AppContext.BaseDirectory, "messages");
            services.AddSingleton<ITranslator>(new Translator(messagesDir));

            return services;
        }
    }

    /// <summary>
    /// Extension methods for <see cref="IApplicationBuilder"/>.
    /// </summary>
    extension(IApplicationBuilder app)
    {
        /// <summary>
        /// Adds translation middleware to the application pipeline.
        /// Translates D2Result message keys and input error keys to localized text.
        /// </summary>
        ///
        /// <returns>
        /// The application builder for chaining.
        /// </returns>
        /// <remarks>
        /// Must be placed AFTER idempotency middleware so it wraps all endpoint responses.
        /// </remarks>
        public IApplicationBuilder UseTranslation()
        {
            app.UseMiddleware<TranslationMiddleware>();

            return app;
        }
    }
}
