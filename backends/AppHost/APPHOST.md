# AppHost

.NET Aspire orchestration project managing local development environment configuration. Defines service resources, dependencies, and inter-service communication patterns for the entire D²-WORX microservices stack.

## Files

| File Name                                                    | Description                                                                                                                                                                                                 |
|--------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [AppHost.cs](AppHost.cs)                                     | Main orchestration entry point configuring all service resources (Geo, REST gateway, PostgreSQL, Redis, RabbitMQ, observability stack) with service discovery, health checks, and dependency relationships. |
| [ServiceExtensions.cs](ServiceExtensions.cs)                 | Extension methods for resource configuration including database initialization, message broker setup, and shared infrastructure component registration with consistent naming conventions.                  |
| [appsettings.json](appsettings.json)                         | Base configuration for Aspire dashboard and resource defaults used across all environments.                                                                                                                 |
| [appsettings.Development.json](appsettings.Development.json) | Development-specific overrides for local debugging including connection strings, logging levels, and resource allocation settings.                                                                          |
