// -----------------------------------------------------------------------
// <copyright file="AppHost.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

using AppHost;
using D2.Shared.Utilities.Configuration;
using static AppHost.ServiceExtensions;

// ReSharper disable UnusedVariable

// Load environment variables from .env.local / .env file.
// .env.local is the SINGLE SOURCE OF TRUTH for all configuration.
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
var minioName = Env("MINIO_NAME");
var minioVolume = Env("MINIO_VOLUME");
var minioTokensVolume = Env("MINIO_TOKENS_VOLUME");
var minioBucketLoki = Env("MINIO_BUCKET_LOKI");
var minioBucketTempo = Env("MINIO_BUCKET_TEMPO");
var minioBucketMimirBlocks = Env("MINIO_BUCKET_MIMIR_BLOCKS");
var minioBucketMimirRuler = Env("MINIO_BUCKET_MIMIR_RULER");
var minioBucketUploads = Env("MINIO_BUCKET_UPLOADS");

var minio = builder.AddContainer(minioName, Env("MINIO_IMAGE"), Env("MINIO_TAG"))
    .WithContainerName(minioName)
    .WithIconName("ScanObject")
    .WithHttpEndpoint(port: EnvInt("MINIO_API_PORT"), targetPort: 9000, name: "minio-api", isProxied: false)
    .WithHttpEndpoint(port: EnvInt("MINIO_CONSOLE_PORT"), targetPort: 9001, name: "minio-console")
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WithEnvironment("MINIO_BROWSER", "on")
    .WithVolume(minioVolume, "/data")
    .WithArgs("server", "/data", "--console-address", ":9001")
    .WithLifetime(ContainerLifetime.Persistent)
    .WithExternalHttpEndpoints();

// MinIO Client - Used to initialize buckets.
var minioInitName = Env("MINIO_INIT_NAME");
var minioInit = builder.AddContainer(minioInitName, Env("MINIO_MC_IMAGE"), Env("MINIO_MC_TAG"))
    .WithContainerName(minioInitName)
    .WithIconName("StarArrowRightStart")
    .WaitFor(minio)
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WithEnvironment("MINIO_PROMETHEUS_AUTH_TYPE", "public")
    .WithVolume(minioTokensVolume, "/minio-token")
    .WithEntrypoint("/bin/sh")
    .WithArgs(
        "-c",
        $"mc alias set myminio http://{minioName}:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD && mc mb --ignore-existing myminio/{minioBucketLoki} && mc mb --ignore-existing myminio/{minioBucketTempo} && mc mb --ignore-existing myminio/{minioBucketMimirBlocks} && mc mb --ignore-existing myminio/{minioBucketMimirRuler} && mc mb --ignore-existing myminio/{minioBucketUploads} && mc admin prometheus generate myminio > /minio-token/prometheus-config.yaml && echo 'MinIO buckets and Prometheus token initialized successfully'")
    .WithLifetime(ContainerLifetime.Session);

/******************************************
 ************** Observability *************
 ******************************************/

var observabilityConfigPath = Env("OBSERVABILITY_CONFIG_PATH");

// Loki - Log Aggregation.
var lokiName = Env("LOKI_NAME");
var loki = builder.AddContainer(lokiName, Env("LOKI_IMAGE"), Env("LOKI_TAG"))
    .WithContainerName(lokiName)
    .WithIconName("DocumentText")
    .WithHttpEndpoint(port: EnvInt("LOKI_HTTP_PORT"), targetPort: 3100, name: "loki-http", isProxied: false)
    .WithHttpEndpoint(port: EnvInt("LOKI_GRPC_PORT"), targetPort: 9095, name: "loki-grpc", isProxied: false)
    .WithBindMount($"{observabilityConfigPath}/loki/config", "/etc/loki", isReadOnly: true)
    .WithVolume(Env("LOKI_VOLUME"), "/loki")
    .WithArgs("-config.file=/etc/loki/loki.yaml", "-config.expand-env=true")
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WithEnvironment("MINIO_NAME", minioName)
    .WithEnvironment("MINIO_BUCKET_LOKI", minioBucketLoki)
    .WaitForCompletion(minioInit)
    .WithLifetime(ContainerLifetime.Persistent);

// Tempo - Distributed Tracing.
var tempoName = Env("TEMPO_NAME");
var tempo = builder.AddContainer(tempoName, Env("TEMPO_IMAGE"), Env("TEMPO_TAG"))
    .WithContainerName(tempoName)
    .WithIconName("Timeline")
    .WithHttpEndpoint(port: EnvInt("TEMPO_HTTP_PORT"), targetPort: 3200, name: "tempo-http", isProxied: false)
    .WithHttpEndpoint(port: EnvInt("TEMPO_GRPC_PORT"), targetPort: 9096, name: "tempo-grpc", isProxied: false)
    .WithBindMount($"{observabilityConfigPath}/tempo/config", "/etc/tempo", isReadOnly: true)
    .WithVolume(Env("TEMPO_VOLUME"), "/var/tempo")
    .WithArgs("-config.file=/etc/tempo/tempo.yaml", "-config.expand-env=true")
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WithEnvironment("MINIO_NAME", minioName)
    .WithEnvironment("MINIO_BUCKET_TEMPO", minioBucketTempo)
    .WaitForCompletion(minioInit)
    .WithLifetime(ContainerLifetime.Persistent);

// Mimir - Metrics.
var mimirName = Env("MIMIR_NAME");
var mimir = builder.AddContainer(mimirName, Env("MIMIR_IMAGE"), Env("MIMIR_TAG"))
    .WithContainerName(mimirName)
    .WithIconName("TopSpeed")
    .WithHttpEndpoint(port: EnvInt("MIMIR_HTTP_PORT"), targetPort: 9009, name: "mimir-http", isProxied: false)
    .WithHttpEndpoint(port: EnvInt("MIMIR_GRPC_PORT"), targetPort: 9097, name: "mimir-grpc", isProxied: false)
    .WithBindMount($"{observabilityConfigPath}/mimir/config", "/etc/mimir", isReadOnly: true)
    .WithVolume(Env("MIMIR_VOLUME"), "/var/mimir")
    .WithArgs("-config.file=/etc/mimir/mimir.yaml", "-config.expand-env=true")
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)
    .WithEnvironment("MINIO_NAME", minioName)
    .WithEnvironment("MINIO_BUCKET_MIMIR_BLOCKS", minioBucketMimirBlocks)
    .WithEnvironment("MINIO_BUCKET_MIMIR_RULER", minioBucketMimirRuler)
    .WaitForCompletion(minioInit)
    .WithLifetime(ContainerLifetime.Persistent);

// cAdvisor - Container Resource Monitoring.
var cadvisorName = Env("CADVISOR_NAME");
var cAdvisor = builder.AddContainer(cadvisorName, Env("CADVISOR_IMAGE"), Env("CADVISOR_TAG"))
    .WithContainerName(cadvisorName)
    .WithIconName("ChartMultiple")
    .WithHttpEndpoint(port: EnvInt("CADVISOR_PORT"), targetPort: 8080, name: "cadvisor-http", isProxied: false)
    .WithBindMount("/", "/rootfs", isReadOnly: true)
    .WithBindMount("/var/run", "/var/run", isReadOnly: true)
    .WithBindMount("/sys", "/sys", isReadOnly: true)
    .WithBindMount("/var/lib/docker", "/var/lib/docker", isReadOnly: true)
    .WithArgs(
        "--housekeeping_interval=10s",
        "--docker_only=true")
    .WithLifetime(ContainerLifetime.Persistent);

// Grafana Alloy - Unified Agent for Metrics, Logs and Traces.
var alloyName = Env("ALLOY_NAME");
var grafanaAlloy = builder.AddContainer(alloyName, Env("ALLOY_IMAGE"), Env("ALLOY_TAG"))
    .WithContainerName(alloyName)
    .WithIconName("Agents")
    .WithHttpEndpoint(port: EnvInt("ALLOY_HTTP_PORT"), targetPort: 12345, name: "alloy-http", isProxied: false)
    .WithHttpEndpoint(port: EnvInt("OTLP_GRPC_PORT"), targetPort: 4317, name: "otlp-grpc", isProxied: false)
    .WithHttpEndpoint(port: EnvInt("OTLP_HTTP_PORT"), targetPort: 4318, name: "otlp-http", isProxied: false)
    .WithHttpEndpoint(port: EnvInt("FARO_RECEIVER_PORT"), targetPort: 12347, name: "faro-receiver", isProxied: false)
    .WithEnvironment("ALLOY_DEPLOY_MODE", "docker")
    .WithEnvironment("MINIO_ROOT_USER", s3Username)
    .WithEnvironment("MINIO_ROOT_PASSWORD", s3Password)

    // Container names + endpoints for config.alloy env() references.
    .WithEnvironment("CADVISOR_NAME", cadvisorName)
    .WithEnvironment("GATEWAY_METRICS_ENDPOINT", Env("GATEWAY_METRICS_ENDPOINT"))
    .WithEnvironment("GEO_METRICS_ENDPOINT", Env("GEO_METRICS_ENDPOINT"))
    .WithEnvironment("PG_EXPORTER_NAME", Env("PG_EXPORTER_NAME"))
    .WithEnvironment("REDIS_EXPORTER_NAME", Env("REDIS_EXPORTER_NAME"))
    .WithEnvironment("RABBITMQ_NAME", Env("RABBITMQ_NAME"))
    .WithEnvironment("MIMIR_NAME", mimirName)
    .WithEnvironment("LOKI_NAME", lokiName)
    .WithEnvironment("TEMPO_NAME", tempoName)
    .WithEnvironment("MINIO_NAME", minioName)
    .WithEnvironment("OTEL_CLUSTER_NAME", Env("OTEL_CLUSTER_NAME"))
    .WithEnvironment("OTEL_ENVIRONMENT", Env("OTEL_ENVIRONMENT"))
    .WithEnvironment("FARO_CORS_ORIGINS", Env("FARO_CORS_ORIGINS"))
    .WithBindMount("/proc", "/rootproc", isReadOnly: true)
    .WithBindMount("/sys", "/sys", isReadOnly: true)
    .WithBindMount("/", "/rootfs", isReadOnly: true)
    .WithBindMount("/var/lib/docker", "/var/lib/docker", isReadOnly: true)
    .WithBindMount("/var/run/docker.sock", "/var/run/docker.sock", isReadOnly: true)
    .WithBindMount($"{observabilityConfigPath}/alloy/config", "/etc/alloy", isReadOnly: true)
    .WithVolume(Env("ALLOY_VOLUME"), "/var/lib/alloy/data")
    .WithVolume(minioTokensVolume, "/minio-token", isReadOnly: true)
    .WithArgs(
        "run",
        "/etc/alloy/config.alloy",
        "--server.http.listen-addr=0.0.0.0:12345",
        "--stability.level=public-preview")
    .WaitFor(cAdvisor)
    .WaitFor(mimir)
    .WaitFor(loki)
    .WaitFor(tempo)
    .WaitForCompletion(minioInit)
    .WithLifetime(ContainerLifetime.Persistent);

// Grafana - Visualization.
var grafanaName = Env("GRAFANA_NAME");
var grafana = builder.AddContainer(grafanaName, Env("GRAFANA_IMAGE"), Env("GRAFANA_TAG"))
    .WithContainerName(grafanaName)
    .WithIconName("ChartPerson")
    .WithHttpEndpoint(port: EnvInt("GRAFANA_PORT"), targetPort: 3000, name: "grafana")
    .WithBindMount(
        $"{observabilityConfigPath}/grafana/provisioning",
        "/etc/grafana/provisioning",
        isReadOnly: true)
    .WithVolume(Env("GRAFANA_VOLUME"), "/var/grafana")

    // Security - Require authentication.
    .WithEnvironment("GF_SECURITY_ADMIN_USER", otelUser)
    .WithEnvironment("GF_SECURITY_ADMIN_PASSWORD", otelPassword)
    .WithEnvironment("GF_AUTH_ANONYMOUS_ENABLED", "false")
    .WithEnvironment("GF_AUTH_BASIC_ENABLED", "true")
    .WithEnvironment("GF_USERS_ALLOW_SIGN_UP", "false")
    .WithEnvironment("GF_USERS_ALLOW_ORG_CREATE", "false")
    .WithEnvironment("GF_SNAPSHOTS_EXTERNAL_ENABLED", "false")

    // Security - Values differ between DEV and PROD (set in .env.local).
    .WithEnvironment("GF_SECURITY_COOKIE_SECURE", Env("GRAFANA_COOKIE_SECURE"))
    .WithEnvironment("GF_SECURITY_COOKIE_SAMESITE", Env("GRAFANA_COOKIE_SAMESITE"))
    .WithEnvironment("GF_SECURITY_STRICT_TRANSPORT_SECURITY", Env("GRAFANA_STRICT_TRANSPORT_SECURITY"))

    // Features.
    .WithEnvironment("GF_FEATURE_TOGGLES_ENABLE", "traceqlEditor")

    // Datasource container names for provisioning env var expansion.
    .WithEnvironment("MIMIR_NAME", mimirName)
    .WithEnvironment("LOKI_NAME", lokiName)
    .WithEnvironment("TEMPO_NAME", tempoName)
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
var postgresName = Env("POSTGRES_NAME");
var db = builder.AddPostgres(
        postgresName,
        dbUsername,
        dbPassword,
        EnvInt("POSTGRES_PORT"))
    .WithContainerName(postgresName)
    .WithIconName("DatabaseStack")
    .WithImageTag(Env("POSTGRES_TAG"))
    .WithEnvironment("PGDATA", "/var/lib/postgresql/data") // PG 18+ default changed; Aspire fix pending (dotnet/aspire#13792)
    .WithDataVolume(Env("POSTGRES_VOLUME"))
    .WithLifetime(ContainerLifetime.Persistent)
    .WithPgAdmin(x =>
    {
        var pgAdminName = Env("PGADMIN_NAME");
        x.WithHostPort(EnvInt("PGADMIN_PORT"));
        x.WithIconName("DatabasePerson");
        x.WithContainerName(pgAdminName);
        x.WithImageTag(Env("PGADMIN_TAG"));
        x.WithLifetime(ContainerLifetime.Persistent);
        x.WithEnvironment("PGADMIN_DEFAULT_EMAIL", dbaEmail);
        x.WithEnvironment("PGADMIN_DEFAULT_PASSWORD", dbaPassword);
        x.WithEnvironment("PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED", "True");
        x.WithEnvironment("PGADMIN_CONFIG_ENHANCED_COOKIE_PROTECTION", "True");
    });

// Postgres Exporter - PostgreSQL Server Monitoring.
var pgExporterName = Env("PG_EXPORTER_NAME");
var postgresExporter = builder.AddContainer(
        pgExporterName, Env("PG_EXPORTER_IMAGE"), Env("PG_EXPORTER_TAG"))
    .WithContainerName(pgExporterName)
    .WithIconName("DatabasePlugConnected")
    .WithEnvironment(
        "DATA_SOURCE_NAME",
        $"postgresql://{dbUsername}:{dbPassword}@{postgresName}:5432/postgres?sslmode=disable")
    .WithHttpEndpoint(port: EnvInt("PG_EXPORTER_PORT"), targetPort: 9187, name: "metrics", isProxied: false)
    .WaitFor(db)
    .WithLifetime(ContainerLifetime.Persistent);

// Redis - Cache.
var redisName = Env("REDIS_NAME");
var cache = builder.AddRedis(redisName, EnvInt("REDIS_PORT"), cachePassword)
    .WithoutHttpsCertificate()
    .WithContainerName(redisName)
    .WithIconName("Memory")
    .WithImageTag(Env("REDIS_TAG"))
    .WithDataVolume(Env("REDIS_VOLUME"))
    .WithLifetime(ContainerLifetime.Persistent)
    .WithRedisInsight(x =>
    {
        var redisInsightName = Env("REDISINSIGHT_NAME");
        x.WithHostPort(EnvInt("REDISINSIGHT_PORT"));
        x.WithIconName("BookSearch");
        x.WithContainerName(redisInsightName);
        x.WithImageTag(Env("REDISINSIGHT_TAG"));
        x.WithDataVolume(Env("REDISINSIGHT_VOLUME"));
        x.WithLifetime(ContainerLifetime.Persistent);
    });

// Redis Exporter - Redis Monitoring.
var redisExporterName = Env("REDIS_EXPORTER_NAME");
var redisExporter = builder.AddContainer(
        redisExporterName, Env("REDIS_EXPORTER_IMAGE"), Env("REDIS_EXPORTER_TAG"))
    .WithContainerName(redisExporterName)
    .WithIconName("ChartLine")
    .WithEnvironment("REDIS_ADDR", $"{redisName}:6379")
    .WithEnvironment("REDIS_PASSWORD", cachePassword)
    .WithHttpEndpoint(port: EnvInt("REDIS_EXPORTER_PORT"), targetPort: 9121, name: "metrics", isProxied: false)
    .WaitFor(cache)
    .WithLifetime(ContainerLifetime.Persistent);

// RabbitMQ - Message Broker.
var rabbitmqName = Env("RABBITMQ_NAME");
var broker = builder.AddRabbitMQ(rabbitmqName, mqUsername, mqPassword, EnvInt("RABBITMQ_PORT"))
    .WithContainerName(rabbitmqName)
    .WithIconName("Mailbox")
    .WithImageTag(Env("RABBITMQ_TAG"))
    .WithDataVolume(Env("RABBITMQ_VOLUME"))
    .WithHttpEndpoint(port: EnvInt("RABBITMQ_METRICS_PORT"), targetPort: 15692, name: "metrics", isProxied: false)
    .WithLifetime(ContainerLifetime.Persistent)
    .WithManagementPlugin(port: EnvInt("RABBITMQ_MGMT_PORT"));

// Dkron - Distributed Job Scheduler.
var dkronName = Env("DKRON_NAME");
var dkron = builder.AddContainer(dkronName, Env("DKRON_IMAGE"), Env("DKRON_TAG"))
    .WithContainerName(dkronName)
    .WithIconName("CalendarClock")
    .WithHttpEndpoint(port: EnvInt("DKRON_DASHBOARD_PORT"), targetPort: 8080, name: "dkron-dashboard")
    .WithVolume(Env("DKRON_VOLUME"), "/dkron.data")
    .WithArgs("agent", "--server", "--bootstrap-expect=1", $"--node-name={dkronName}")
    .WithLifetime(ContainerLifetime.Persistent);

/******************************************
 **************** Services ****************
 ******************************************/

// Geo - Service (.NET gRPC).
var geoDb = db.AddDatabase(Env("GEO_DB_NAME"));
var geoService = builder.AddProject<Projects.Geo_API>(Env("GEO_SERVICE_NAME"))
    .WithIconName("Location")
    .WithReference(geoDb)
    .DefaultInfraRefs(db, cache, broker)
    .WithOtelRefs();

// Auth - Service (Node.js / Hono).
var authDb = db.AddDatabase(Env("AUTH_DB_NAME"));
var authService = builder.AddJavaScriptApp(Env("AUTH_SERVICE_NAME"), "../../../../backends/node/services/auth/api")
    .WithPnpm()
    .WithIconName("ShieldPerson")
    .WithReference(authDb)
    .WaitFor(db)
    .WaitFor(cache)
    .WithReference(cache)
    .WaitFor(broker)
    .WithReference(broker)
    .WaitFor(geoService)
    .WithHttpEndpoint(port: EnvInt("AUTH_HTTP_PORT"), targetPort: 5100, name: "auth-http", isProxied: false)
    .WithHttpEndpoint(port: EnvInt("AUTH_GRPC_PORT"), targetPort: 5101, name: "auth-grpc", isProxied: false)
    .WithOtelRefs();

// Comms - Service (Node.js / headless consumer + gRPC).
var commsDb = db.AddDatabase(Env("COMMS_DB_NAME"));
var commsService = builder.AddJavaScriptApp(Env("COMMS_SERVICE_NAME"), "../../../../backends/node/services/comms/api")
    .WithPnpm()
    .WithIconName("Mail")
    .WithReference(commsDb)
    .WaitFor(db)
    .WaitFor(cache)
    .WithReference(cache)
    .WaitFor(broker)
    .WithReference(broker)
    .WaitFor(geoService)
    .WithHttpEndpoint(port: EnvInt("COMMS_GRPC_PORT"), targetPort: 5200, name: "comms-grpc", isProxied: false)
    .WithOtelRefs();

// REST API - Gateway.
// Service addresses (GEO_GRPC_ADDRESS, AUTH_GRPC_ADDRESS, COMMS_GRPC_ADDRESS)
// are read from env vars by the Gateway, not injected via Aspire WithReference.
var restGateway = builder.AddProject<Projects.REST>(Env("GATEWAY_SERVICE_NAME"))
    .WithIconName("Globe")

    // Wait for services to be ready (Gateway reads addresses from env vars).
    .WaitFor(geoService)
    .WaitFor(authService)
    .WaitFor(commsService)

    // Redis dependency for rate limiting.
    .WaitFor(cache)
    .WithReference(cache)

    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints()
    .WithOtelRefs();

// Dkron Manager — Job reconciler (Node.js loop service).
builder.AddJavaScriptApp(
        Env("DKRON_MGR_SERVICE_NAME"), "../../../../backends/node/services/dkron-mgr")
    .WithPnpm()
    .WithIconName("CalendarSync")
    .WaitFor(dkron)
    .WaitFor(restGateway)
    .WithOtelRefs();

// SvelteKit - Frontend.
var svelte = builder.AddViteApp(
        Env("SVELTEKIT_SERVICE_NAME"),
        "../../../../clients/web")
    .WaitFor(restGateway)
    .WaitFor(geoService)
    .WaitFor(authService)
    .WithPnpm()
    .WithArgs("--host", "0.0.0.0", "--port", Env("SVELTEKIT_PORT"))
    .WithIconName("DesktopCursor")
    .WithExternalHttpEndpoints()
    .WithReference(cache)
    .WithReference(geoService)
    .WithEnvironment("SVELTEKIT_GATEWAY__URL", restGateway.GetEndpoint("http"))
    .WithEnvironment("PUBLIC_GATEWAY_URL", restGateway.GetEndpoint("http"))
    .WithEnvironment("PUBLIC_FARO_COLLECTOR_URL", Env("PUBLIC_FARO_COLLECTOR_URL"));

builder.Build().Run();
