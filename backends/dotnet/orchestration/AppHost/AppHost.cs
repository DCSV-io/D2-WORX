// -----------------------------------------------------------------------
// <copyright file="AppHost.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

using AppHost;
using D2.Shared.Utilities.Configuration;

// ReSharper disable UnusedVariable

// Load environment variables from .env.local / .env file.
D2Env.Load();

var builder = DistributedApplication.CreateBuilder(args);

// Define all params to pass to containers.
var dbUsername = builder.AddParameter("db-username", true);
var dbPassword = builder.AddParameter("db-password", true);
var dbaEmail = builder.AddParameter("dba-email", true);
var dbaPassword = builder.AddParameter("dba-password", true);
var cachePassword = builder.AddParameter("cache-password", true);
var mqUsername = builder.AddParameter("mq-username", true);
var mqPassword = builder.AddParameter("mq-password", true);
var otelUser = builder.AddParameter("otel-username", true);
var otelPassword = builder.AddParameter("otel-password", true);
var s3Username = builder.AddParameter("s3-username", true);
var s3Password = builder.AddParameter("s3-password", true);

/******************************************
 ************* Object Storage *************
 ******************************************/

// MinIO - S3 Compatible Object Storage.
var minio = builder.AddContainer("d2-minio", "minio/minio", "RELEASE.2025-09-07T16-13-09Z")
    .WithContainerName("d2-minio")
    .WithIconName("ScanObject")
    .WithHttpEndpoint(port: 9000, targetPort: 9000, name: "minio-api", isProxied: false)
    .WithHttpEndpoint(port: 9001, targetPort: 9001, name: "minio-console")
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WithEnvironment("MINIO_BROWSER", "on")
    .WithVolume("d2-minio-data", "/data")
    .WithArgs("server", "/data", "--console-address", ":9001")
    .WithLifetime(ContainerLifetime.Persistent)
    .WithExternalHttpEndpoints();

// MinIO Client - Used to initialize buckets.
var minioInit = builder.AddContainer("d2-minio-init", "minio/mc", "RELEASE.2025-08-13T08-35-41Z")
    .WithContainerName("d2-minio-init")
    .WithIconName("StarArrowRightStart")
    .WaitFor(minio)
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WithEnvironment("MINIO_PROMETHEUS_AUTH_TYPE", "public")
    .WithVolume("d2-minio-tokens", "/minio-token")
    .WithEntrypoint("/bin/sh")
    .WithArgs(
        "-c",
        "mc alias set myminio http://d2-minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD && mc mb --ignore-existing myminio/loki-logs && mc mb --ignore-existing myminio/tempo-traces && mc mb --ignore-existing myminio/mimir-blocks && mc mb --ignore-existing myminio/mimir-ruler && mc mb --ignore-existing myminio/minio-uploads && mc admin prometheus generate myminio > /minio-token/prometheus-config.yaml && echo 'MinIO buckets and Prometheus token initialized successfully'")
    .WithLifetime(ContainerLifetime.Session);

/******************************************
 ************** Observability *************
 ******************************************/

// Loki - Log Aggregation.
var loki = builder.AddContainer("d2-loki", "grafana/loki", "3.5.10")
    .WithContainerName("d2-loki")
    .WithIconName("DocumentText")
    .WithHttpEndpoint(port: 3100, targetPort: 3100, name: "loki-http", isProxied: false)
    .WithHttpEndpoint(port: 9095, targetPort: 9095, name: "loki-grpc", isProxied: false)
    .WithBindMount("../../../../observability/loki/config", "/etc/loki", isReadOnly: true)
    .WithVolume("d2-loki-data", "/loki")
    .WithArgs("-config.file=/etc/loki/loki.yaml", "-config.expand-env=true")
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WaitForCompletion(minioInit)
    .WithLifetime(ContainerLifetime.Persistent);

// Tempo - Distributed Tracing.
var tempo = builder.AddContainer("d2-tempo", "grafana/tempo", "2.10.1")
    .WithContainerName("d2-tempo")
    .WithIconName("Timeline")
    .WithHttpEndpoint(port: 3200, targetPort: 3200, name: "tempo-http", isProxied: false)
    .WithHttpEndpoint(port: 9096, targetPort: 9096, name: "tempo-grpc", isProxied: false)
    .WithBindMount("../../../../observability/tempo/config", "/etc/tempo", isReadOnly: true)
    .WithVolume("d2-tempo-data", "/var/tempo")
    .WithArgs("-config.file=/etc/tempo/tempo.yaml", "-config.expand-env=true")
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WaitForCompletion(minioInit)
    .WithLifetime(ContainerLifetime.Persistent);

// Mimir - Metrics.
var mimir = builder.AddContainer("d2-mimir", "grafana/mimir", "2.17.7")
    .WithContainerName("d2-mimir")
    .WithIconName("TopSpeed")
    .WithHttpEndpoint(port: 9009, targetPort: 9009, name: "mimir-http", isProxied: false)
    .WithHttpEndpoint(port: 9097, targetPort: 9097, name: "mimir-grpc", isProxied: false)
    .WithBindMount("../../../../observability/mimir/config", "/etc/mimir", isReadOnly: true)
    .WithVolume("d2-mimir-data", "/var/mimir")
    .WithArgs("-config.file=/etc/mimir/mimir.yaml", "-config.expand-env=true")
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WaitForCompletion(minioInit)
    .WithLifetime(ContainerLifetime.Persistent);

// cAdvisor - Container Resource Monitoring.
var cAdvisor = builder.AddContainer("d2-cadvisor", "ghcr.io/google/cadvisor", "v0.56.2")
    .WithContainerName("d2-cadvisor")
    .WithIconName("ChartMultiple")
    .WithHttpEndpoint(port: 8081, targetPort: 8080, name: "cadvisor-http", isProxied: false)
    .WithBindMount("/", "/rootfs", isReadOnly: true)
    .WithBindMount("/var/run", "/var/run", isReadOnly: true)
    .WithBindMount("/sys", "/sys", isReadOnly: true)
    .WithBindMount("/var/lib/docker", "/var/lib/docker", isReadOnly: true)
    .WithArgs(
        "--housekeeping_interval=10s",
        "--docker_only=true")
    .WithLifetime(ContainerLifetime.Persistent);

// Grafana Alloy - Unified Agent for Metrics, Logs and Traces.
var grafanaAlloy = builder.AddContainer("d2-grafana-alloy", "grafana/alloy", "v1.13.2")
    .WithContainerName("d2-grafana-alloy")
    .WithIconName("Agents")
    .WithHttpEndpoint(port: 12345, targetPort: 12345, name: "alloy-http", isProxied: false)
    .WithHttpEndpoint(port: 4317, targetPort: 4317, name: "otlp-grpc", isProxied: false)
    .WithHttpEndpoint(port: 4318, targetPort: 4318, name: "otlp-http", isProxied: false)
    .WithEnvironment("ALLOY_DEPLOY_MODE", "docker")
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WithBindMount("/proc", "/rootproc", isReadOnly: true)
    .WithBindMount("/sys", "/sys", isReadOnly: true)
    .WithBindMount("/", "/rootfs", isReadOnly: true)
    .WithBindMount("/var/lib/docker", "/var/lib/docker", isReadOnly: true)
    .WithBindMount("/var/run/docker.sock", "/var/run/docker.sock", isReadOnly: true)
    .WithBindMount("../../../../observability/alloy/config", "/etc/alloy", isReadOnly: true)
    .WithVolume("d2-alloy-data", "/var/lib/alloy/data")
    .WithVolume("d2-minio-tokens", "/minio-token", isReadOnly: true)
    .WithArgs(
        "run",
        "/etc/alloy/config.alloy",
        "--server.http.listen-addr=0.0.0.0:12345",
        "--stability.level=generally-available")
    .WaitFor(cAdvisor)
    .WaitFor(mimir)
    .WaitFor(loki)
    .WaitFor(tempo)
    .WaitForCompletion(minioInit)
    .WithLifetime(ContainerLifetime.Persistent);

// Grafana - Visualization.
var grafana = builder.AddContainer("d2-grafana", "grafana/grafana", "12.4.0")
    .WithContainerName("d2-grafana")
    .WithIconName("ChartPerson")
    .WithHttpEndpoint(port: 3000, targetPort: 3000, name: "grafana")
    .WithBindMount(
        "../../../../observability/grafana/provisioning",
        "/etc/grafana/provisioning",
        isReadOnly: true)
    .WithVolume("d2-grafana-data", "/var/grafana")

    // Security - Require authentication.
    .WithEnvironment("GF_SECURITY_ADMIN_USER", otelUser)
    .WithEnvironment("GF_SECURITY_ADMIN_PASSWORD", otelPassword)
    .WithEnvironment("GF_AUTH_ANONYMOUS_ENABLED", "false")
    .WithEnvironment("GF_AUTH_BASIC_ENABLED", "true")
    .WithEnvironment("GF_USERS_ALLOW_SIGN_UP", "false")
    .WithEnvironment("GF_USERS_ALLOW_ORG_CREATE", "false")
    .WithEnvironment("GF_SNAPSHOTS_EXTERNAL_ENABLED", "false")

    // Security - Defaults for DEV ONLY - should be true, strict and true for PROD.
    .WithEnvironment("GF_SECURITY_COOKIE_SECURE", "false")
    .WithEnvironment("GF_SECURITY_COOKIE_SAMESITE", "lax")
    .WithEnvironment("GF_SECURITY_STRICT_TRANSPORT_SECURITY", "false")

    // Features.
    .WithEnvironment("GF_FEATURE_TOGGLES_ENABLE", "traceqlEditor")
    .WithLifetime(ContainerLifetime.Persistent)
    .WithExternalHttpEndpoints()

    // Wait for dependencies so that provisioning works.
    .WaitFor(tempo)
    .WaitFor(loki)
    .WaitFor(mimir);

/******************************************
 ************* Infrastructure *************
 ******************************************/

// PostgreSQL - Relational Database.
var db = builder.AddPostgres(
        "d2-postgres",
        dbUsername,
        dbPassword,
        54320)
    .WithContainerName("d2-postgres")
    .WithIconName("DatabaseStack")
    .WithImageTag("18.3-trixie")
    .WithEnvironment("PGDATA", "/var/lib/postgresql/data") // PG 18+ default changed; Aspire fix pending (dotnet/aspire#13792)
    .WithDataVolume("d2-postgres-data")
    .WithLifetime(ContainerLifetime.Persistent)
    .WithPgAdmin(x =>
    {
        x.WithHostPort(5533);
        x.WithIconName("DatabasePerson");
        x.WithContainerName("d2-pgadmin4");
        x.WithImageTag("9.12");
        x.WithLifetime(ContainerLifetime.Persistent);
        x.WithEnvironment("PGADMIN_DEFAULT_EMAIL", dbaEmail);
        x.WithEnvironment("PGADMIN_DEFAULT_PASSWORD", dbaPassword);
        x.WithEnvironment("PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED", "True");
        x.WithEnvironment("PGADMIN_CONFIG_ENHANCED_COOKIE_PROTECTION", "True");
    });

// Postgres Exporter - PostgreSQL Server Monitoring.
var postgresExporter = builder.AddContainer(
        "d2-postgres-exporter", "prometheuscommunity/postgres-exporter", "v0.19.1")
    .WithContainerName("d2-postgres-exporter")
    .WithIconName("DatabasePlugConnected")
    .WithEnvironment(
        "DATA_SOURCE_NAME",
        $"postgresql://{dbUsername}:{dbPassword}@d2-postgres:5432/postgres?sslmode=disable")
    .WithHttpEndpoint(port: 9187, targetPort: 9187, name: "metrics", isProxied: false)
    .WaitFor(db)
    .WithLifetime(ContainerLifetime.Persistent);

// Redis - Cache.
var cache = builder.AddRedis("d2-redis", 6379, cachePassword)
    .WithoutHttpsCertificate()
    .WithContainerName("d2-redis")
    .WithIconName("Memory")
    .WithImageTag("8.2.4-bookworm")
    .WithDataVolume("d2-redis-data")
    .WithLifetime(ContainerLifetime.Persistent)
    .WithRedisInsight(x =>
    {
        x.WithHostPort(5540);
        x.WithIconName("BookSearch");
        x.WithContainerName("d2-redisinsight");
        x.WithImageTag("2.70.1");
        x.WithDataVolume("d2-redisinsight-data");
        x.WithLifetime(ContainerLifetime.Persistent);
    });

// Redis Exporter - Redis Monitoring.
var redisExporter = builder.AddContainer(
        "d2-redis-exporter", "oliver006/redis_exporter", "v1.80.1")
    .WithContainerName("d2-redis-exporter")
    .WithIconName("ChartLine")
    .WithEnvironment("REDIS_ADDR", "d2-redis:6379")
    .WithEnvironment("REDIS_PASSWORD", cachePassword)
    .WithHttpEndpoint(port: 9121, targetPort: 9121, name: "metrics", isProxied: false)
    .WaitFor(cache)
    .WithLifetime(ContainerLifetime.Persistent);

// RabbitMQ - Message Broker.
var broker = builder.AddRabbitMQ("d2-rabbitmq", mqUsername, mqPassword, 15672)
    .WithContainerName("d2-rabbitmq")
    .WithIconName("Mailbox")
    .WithImageTag("4.1.7-management")
    .WithDataVolume("d2-rabbitmq-data")
    .WithHttpEndpoint(port: 15692, targetPort: 15692, name: "metrics", isProxied: false)
    .WithLifetime(ContainerLifetime.Persistent)
    .WithManagementPlugin();

// Dkron - Distributed Job Scheduler.
var dkron = builder.AddContainer("d2-dkron", "dkron/dkron", "4.0.9")
    .WithContainerName("d2-dkron")
    .WithIconName("CalendarClock")
    .WithHttpEndpoint(port: 8888, targetPort: 8080, name: "dkron-dashboard")
    .WithVolume("d2-dkron-data", "/dkron.data")
    .WithArgs("agent", "--server", "--bootstrap-expect=1", "--node-name=dkron")
    .WithLifetime(ContainerLifetime.Persistent);

/******************************************
 **************** Services ****************
 ******************************************/

// Geo - Service (.NET gRPC).
var geoDb = db.AddDatabase("d2-services-geo");
var geoService = builder.AddProject<Projects.Geo_API>("d2-geo")
    .WithIconName("Location")
    .WithReference(geoDb)
    .DefaultInfraRefs(db, cache, broker)
    .WithOtelRefs();

// Auth - Service (Node.js / Hono).
var authDb = db.AddDatabase("d2-services-auth");
var authService = builder.AddJavaScriptApp("d2-auth", "../../../../backends/node/services/auth/api", "dev")
    .WithPnpm()
    .WithIconName("ShieldPerson")
    .WithReference(authDb)
    .WaitFor(db)
    .WaitFor(cache)
    .WithReference(cache)
    .WaitFor(broker)
    .WithReference(broker)
    .WaitFor(geoService)
    .WithHttpEndpoint(port: 5100, targetPort: 5100, name: "auth-http", isProxied: false)
    .WithHttpEndpoint(port: 5101, targetPort: 5101, name: "auth-grpc", isProxied: false)
    .WithOtelRefs();

// Comms - Service (Node.js / headless consumer + gRPC).
var commsDb = db.AddDatabase("d2-services-comms");
var commsService = builder.AddJavaScriptApp("d2-comms", "../../../../backends/node/services/comms/api", "dev")
    .WithPnpm()
    .WithIconName("Mail")
    .WithReference(commsDb)
    .WaitFor(db)
    .WaitFor(cache)
    .WithReference(cache)
    .WaitFor(broker)
    .WithReference(broker)
    .WaitFor(geoService)
    .WithHttpEndpoint(port: 5200, targetPort: 5200, name: "comms-grpc", isProxied: false)
    .WithOtelRefs();

// REST API - Gateway.
var restGateway = builder.AddProject<Projects.REST>("d2-rest")
    .WithIconName("Globe")

    // Geo service dependency.
    .WaitFor(geoService)
    .WithReference(geoService)

    // Auth + Comms service refs (for aggregated health check fan-out).
    .WithReference(authService)
    .WithReference(commsService)

    // Redis dependency for rate limiting.
    .WaitFor(cache)
    .WithReference(cache)

    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints()
    .WithOtelRefs();

// Dkron Manager — Job reconciler (Node.js loop service).
builder.AddJavaScriptApp(
        "d2-dkron-mgr", "../../../../backends/node/services/dkron-mgr", "dev")
    .WithPnpm()
    .WithIconName("CalendarSync")
    .WaitFor(dkron)
    .WaitFor(restGateway)
    .WithOtelRefs();

// SvelteKit - Frontend.
var svelte = builder.AddViteApp(
        "d2-sveltekit",
        "../../../../clients/web")
    .WaitFor(restGateway)
    .WithPnpm()
    .WithArgs("--host", "0.0.0.0", "--port", "5173")
    .WithIconName("DesktopCursor")
    .WithExternalHttpEndpoints();

builder.Build().Run();
