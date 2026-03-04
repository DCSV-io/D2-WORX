// -----------------------------------------------------------------------
// <copyright file="ServiceExtensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace AppHost;

/// <summary>
/// Extends the ResourceBuilder.
/// </summary>
internal static class ServiceExtensions
{
    /// <param name="builder">The resource builder for the resource.</param>
    /// <typeparam name="TProject">A type that represents the project reference.</typeparam>
    extension<TProject>(IResourceBuilder<TProject> builder)
        where TProject : IResourceWithEnvironment, IResourceWithWaitSupport
    {
        /// <summary>
        /// Adds references and wait conditions for the default infrastructure services.
        /// </summary>
        /// <param name="db">The resource builder for the PostgreSQL database.</param>
        /// <param name="cache">The resource builder for the Redis cache.</param>
        /// <param name="broker">The resource builder for the RabbitMQ message broker.</param>
        /// <returns>A reference to the <see cref="IResourceBuilder{T}"/>.</returns>
        public IResourceBuilder<TProject> DefaultInfraRefs(
            IResourceBuilder<PostgresServerResource> db,
            IResourceBuilder<RedisResource> cache,
            IResourceBuilder<RabbitMQServerResource> broker)
        {
            builder.WithReference(db);
            builder.WaitFor(db);
            builder.WithReference(cache);
            builder.WaitFor(cache);
            builder.WithReference(broker);
            builder.WaitFor(broker);
            return builder;
        }

        /// <summary>
        /// Adds observability environment variables for traces, logs, and metrics.
        /// Uses standard OTel env var names so both .NET and Node.js SDKs pick them up.
        /// All signals route through Alloy (OTLP HTTP on 4318) → Tempo / Loki / Mimir.
        /// Base URLs are read from <c>OTLP_HTTP_ENDPOINT</c> and <c>LOKI_PUSH_ENDPOINT</c> env vars.
        /// </summary>
        ///
        /// <returns>A reference to the <see cref="IResourceBuilder{T}"/>.</returns>
        public IResourceBuilder<TProject> WithOtelRefs()
        {
            var otlpBase = Env("OTLP_HTTP_ENDPOINT");
            var lokiBase = Env("LOKI_PUSH_ENDPOINT");

            builder.WithEnvironment("OTEL_SERVICE_NAME", builder.Resource.Name);
            builder.WithEnvironment("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", $"{otlpBase}/v1/traces");
            builder.WithEnvironment("OTEL_EXPORTER_OTLP_LOGS_ENDPOINT", $"{otlpBase}/v1/logs");
            builder.WithEnvironment("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT", $"{otlpBase}/v1/metrics");

            // Serilog Loki sink (direct push, not OTLP) — .NET services only.
            builder.WithEnvironment("LOGS_URI", $"{lokiBase}/loki/api/v1/push");
            return builder;
        }
    }

    /// <summary>
    /// Reads a required environment variable. Throws if absent or empty.
    /// All values must be defined in <c>.env.local</c> — the single source of truth.
    /// </summary>
    /// <param name="key">The environment variable name.</param>
    /// <returns>The environment variable value.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the variable is missing or empty.</exception>
    internal static string Env(string key) =>
        Environment.GetEnvironmentVariable(key) is { Length: > 0 } v
            ? v
            : throw new InvalidOperationException(
                $"Required environment variable '{key}' is not set. Add it to .env.local.");

    /// <summary>
    /// Reads a required integer environment variable. Throws if absent, empty, or not a valid integer.
    /// All values must be defined in <c>.env.local</c> — the single source of truth.
    /// </summary>
    /// <param name="key">The environment variable name.</param>
    /// <returns>The parsed integer value.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the variable is missing, empty, or not parseable.</exception>
    internal static int EnvInt(string key)
    {
        var raw = Env(key);
        return int.TryParse(raw, out var v)
            ? v
            : throw new InvalidOperationException(
                $"Environment variable '{key}' value '{raw}' is not a valid integer. Check .env.local.");
    }
}
