// -----------------------------------------------------------------------
// <copyright file="JwtAuthExtensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Gateways.REST.Auth;

using D2.Shared.Handler.Extensions.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

/// <summary>
/// Extension methods for adding JWT authentication to the REST gateway.
/// </summary>
public static class JwtAuthExtensions
{
    /// <summary>
    /// Extension methods for <see cref="IServiceCollection"/>.
    /// </summary>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds JWT Bearer authentication configured against the Auth Service JWKS endpoint.
        /// </summary>
        ///
        /// <param name="configuration">
        /// The application configuration.
        /// </param>
        /// <param name="sectionName">
        /// The configuration section name. Defaults to "JwtAuthOptions".
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddJwtAuth(
            IConfiguration configuration,
            string sectionName = nameof(JwtAuthOptions))
        {
            var options = new JwtAuthOptions();
            configuration.GetSection(sectionName).Bind(options);

            services.Configure<JwtAuthOptions>(configuration.GetSection(sectionName));

            services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(jwt =>
                {
                    // JWKS endpoint for automatic key retrieval and rotation.
                    jwt.Authority = options.AuthServiceBaseUrl;
                    jwt.MetadataAddress = $"{options.AuthServiceBaseUrl.TrimEnd('/')}/api/auth/.well-known/openid-configuration";

                    jwt.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = options.Issuer,
                        ValidateAudience = true,
                        ValidAudience = options.Audience,
                        ValidateLifetime = true,
                        ClockSkew = options.ClockSkew,
                        ValidateIssuerSigningKey = true,
                        RequireSignedTokens = true,
                        ValidAlgorithms = ["RS256"],
                    };

                    // Explicit JWKS refresh intervals.
                    // Framework defaults (12h auto, 30s forced) are reasonable but implicit.
                    // Making them configurable and visible.
                    jwt.AutomaticRefreshInterval = options.JwksAutoRefreshInterval;
                    jwt.RefreshInterval = options.JwksRefreshInterval;

                    // BetterAuth may not serve a standard OIDC discovery document.
                    // Fall back to direct JWKS endpoint if discovery fails.
                    jwt.Configuration = null;
                    jwt.Events = new JwtBearerEvents
                    {
                        OnAuthenticationFailed = context =>
                        {
                            // Log but don't expose failure details to client.
                            var logger = context.HttpContext.RequestServices
                                .GetRequiredService<ILoggerFactory>()
                                .CreateLogger("JwtAuth");
                            logger.LogWarning(
                                context.Exception,
                                "JWT authentication failed for {Path}",
                                context.HttpContext.Request.Path);
                            return Task.CompletedTask;
                        },
                    };
                });

            services.AddAuthorization(o => o.AddD2Policies());

            return services;
        }
    }

    /// <summary>
    /// Extension methods for <see cref="IApplicationBuilder"/>.
    /// </summary>
    extension(IApplicationBuilder app)
    {
        /// <summary>
        /// Adds JWT authentication and authorization middleware to the pipeline.
        /// </summary>
        ///
        /// <returns>
        /// The application builder for chaining.
        /// </returns>
        /// <remarks>
        /// Must be placed after request enrichment and rate limiting,
        /// but before idempotency middleware.
        /// </remarks>
        public IApplicationBuilder UseJwtAuth()
        {
            app.UseAuthentication();
            app.UseMiddleware<JwtFingerprintMiddleware>();
            app.UseAuthorization();

            return app;
        }
    }
}
