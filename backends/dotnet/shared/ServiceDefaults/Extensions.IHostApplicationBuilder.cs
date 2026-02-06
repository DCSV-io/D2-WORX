// -----------------------------------------------------------------------
// <copyright file="Extensions.IHostApplicationBuilder.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.ServiceDefaults;

using D2.Shared.Utilities.Configuration;
using D2.Shared.Utilities.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Formatting.Compact;
using Serilog.Sinks.Grafana.Loki;

public static partial class Extensions
{
    /// <summary>
    /// Extension method for builders that implement <see cref="IHostApplicationBuilder"/>.
    /// </summary>
    ///
    /// <param name="builder">
    /// The application builder.
    /// </param>
    ///
    /// <typeparam name="TBuilder">
    /// The type of the application builder.
    /// </typeparam>
    extension<TBuilder>(TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        /// <summary>
        /// Adds structured logging using Serilog to the application.
        /// </summary>
        private void AddStructuredLogging()
        {
            var logsEndpoint = builder.Configuration["LOGS_URI"];
            var serviceName = builder.Environment.ApplicationName;
            var environment = builder.Environment.EnvironmentName;

            var loggerConfig = new LoggerConfiguration()
                .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
                .MinimumLevel.Override(
                    "Microsoft.Extensions.Http",
                    Serilog.Events.LogEventLevel.Warning)
                .MinimumLevel.Override("System.Net.Http", Serilog.Events.LogEventLevel.Warning)
                .Enrich.FromLogContext()
                .Enrich.WithProperty("service_name", serviceName)
                .Enrich.WithProperty("environment", environment)
                .Enrich.WithMachineName()
                .WriteTo.Console(new CompactJsonFormatter());

            if (logsEndpoint.Truthy())
            {
                var lokiLabels = new List<LokiLabel>
                {
                    new() { Key = "app", Value = serviceName },
                    new() { Key = "environment", Value = environment },
                };

                loggerConfig.WriteTo.GrafanaLoki(
                    logsEndpoint!,
                    labels: lokiLabels,
                    textFormatter: new CompactJsonFormatter(),
                    batchPostingLimit: 1000,
                    period: TimeSpan.FromSeconds(2));
            }

            Log.Logger = loggerConfig.CreateLogger();

            builder.Services.AddSerilog();
        }

        /// <summary>
        /// Configures OpenTelemetry for tracing and metrics.
        /// </summary>
        private void ConfigureOpenTelemetry()
        {
            builder.Logging.AddOpenTelemetry(logging =>
            {
                logging.IncludeFormattedMessage = true;
                logging.IncludeScopes = true;
            });

            builder.Services.AddOpenTelemetry()
                .WithMetrics(metrics =>
                {
                    metrics.AddAspNetCoreInstrumentation()
                        .AddHttpClientInstrumentation()
                        .AddRuntimeInstrumentation()
                        .AddProcessInstrumentation()
                        .AddPrometheusExporter();
                })
                .WithTracing(tracing =>
                {
                    tracing.AddSource(builder.Environment.ApplicationName)
                        .SetResourceBuilder(ResourceBuilder
                            .CreateDefault()
                            .AddService(builder.Environment.ApplicationName))
                        .AddAspNetCoreInstrumentation(x =>
                        {
                            x.Filter = context =>
                                !context.Request.Path.StartsWithSegments(_HEALTH_ENDPOINT_PATH) &&
                                !context.Request.Path.StartsWithSegments(_ALIVE_ENDPOINT_PATH) &&
                                !context.Request.Path.StartsWithSegments(_METRICS_ENDPOINT_PATH);

                            x.RecordException = true;

                            x.EnrichWithHttpRequest = (activity, request) =>
                            {
                                activity.SetTag(
                                    "http.request_id",
                                    request.HttpContext.TraceIdentifier);
                            };

                            x.EnrichWithHttpResponse = (activity, response) =>
                            {
                                activity.SetTag("http.response.status_code", response.StatusCode);
                            };
                        })
                        .AddGrpcClientInstrumentation()
                        .AddHttpClientInstrumentation(x =>
                        {
                            x.RecordException = true;
                            x.FilterHttpRequestMessage = message =>
                            {
                                // Get the request URI.
                                var requestUri = message.RequestUri?.AbsoluteUri ?? string.Empty;

                                // Ensure this is not a request to logs collection.
                                var logsCollUri = builder.Configuration["LOGS_URI"];
                                if (logsCollUri is not null && IsOtlp(logsCollUri))
                                {
                                    return false;
                                }

                                // Ensure this is not a request to our traces' collection.
                                var tracesCollUri = builder.Configuration["TRACES_URI"];
                                if (tracesCollUri is not null && IsOtlp(tracesCollUri))
                                {
                                    return false;
                                }

                                // Otherwise, allow it.
                                return true;

                                // Local function to determine if the URI starts with the given
                                // OTLP endpoint.
                                bool IsOtlp(string otlp)
                                {
                                    return requestUri.StartsWith(
                                        otlp,
                                        StringComparison.OrdinalIgnoreCase);
                                }
                            };
                        });
                });

            builder.AddOpenTelemetryExporters();
        }

        /// <summary>
        /// Adds OpenTelemetry exporters based on configuration.
        /// </summary>
        private void AddOpenTelemetryExporters()
        {
            var tracesCollUri = builder.Configuration["TRACES_URI"];

            if (tracesCollUri.Falsey())
            {
                return;
            }

            builder.Services.ConfigureOpenTelemetryTracerProvider(tracing =>
            {
                tracing.AddOtlpExporter(options =>
                {
                    options.Endpoint = new Uri(tracesCollUri!);
                    options.Protocol = OpenTelemetry.Exporter.OtlpExportProtocol.HttpProtobuf;
                });
            });
        }

        /// <summary>
        /// Adds default health checks to the application.
        /// </summary>
        private void AddDefaultHealthChecks()
        {
            builder.Services.AddHealthChecks()
                .AddCheck("self", () => HealthCheckResult.Healthy(), ["live"]);
        }

        /// <summary>
        /// Adds default services and configurations to the application builder.
        /// </summary>
        public void AddServiceDefaults()
        {
            D2Env.Load();
            builder.Configuration.AddEnvironmentVariables();

            builder.AddStructuredLogging();
            builder.ConfigureOpenTelemetry();
            builder.AddDefaultHealthChecks();

            builder.Services.AddServiceDiscovery();

            builder.Services.ConfigureHttpClientDefaults(http =>
            {
                http.AddStandardResilienceHandler();
                http.AddServiceDiscovery();
            });
        }
    }
}
