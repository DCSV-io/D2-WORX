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
        /// </summary>
        /// <returns>A reference to the <see cref="IResourceBuilder{T}"/>.</returns>
        public IResourceBuilder<TProject> WithOtelRefs()
        {
            builder.WithEnvironment("OTEL_SERVICE_NAME", builder.Resource.Name);
            builder.WithEnvironment("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://localhost:4318/v1/traces");
            builder.WithEnvironment("OTEL_EXPORTER_OTLP_LOGS_ENDPOINT", "http://localhost:4318/v1/logs");
            builder.WithEnvironment("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT", "http://localhost:4318/v1/metrics");

            // Serilog Loki sink (direct push, not OTLP) — .NET services only.
            builder.WithEnvironment("LOGS_URI", "http://localhost:3100/loki/api/v1/push");
            return builder;
        }
    }
}
