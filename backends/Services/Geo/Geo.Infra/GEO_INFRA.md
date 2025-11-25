# Geo.Infra

Infrastructure layer for the Geo microservice implementing Entity Framework Core persistence, MassTransit messaging, database configuration, seed data, and repository handlers.

## Files

| File Name                      | Description                                                                                                                                                              |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [Extensions.cs](Extensions.cs) | DI extension method AddGeoInfra registering GeoDbContext, MassTransit with RabbitMQ (including UpdatedConsumer from GeoRefDataService.Default), and repository handlers. |

---

## Messaging

> ### Handlers
>
> #### Pub (Publishers)
>
> No publisher handlers yet - will implement handlers for publishing GeoRefDataUpdated messages.
>
> #### Sub (Subscribers)
>
> No subscriber handlers yet.
>
> ### MT (MassTransit)
>
> #### Consumers
>
> No Geo-specific consumers - shared consumers (like UpdatedConsumer from GeoRefDataService.Default) are registered via Extensions.cs.
>
> #### Publishers
>
> No Geo-specific publisher classes yet.

---

## Repository

> | File Name                                                   | Description                                                                                                               |
> |-------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
> | [GeoDbContext.cs](Repository/GeoDbContext.cs)               | EF Core DbContext exposing DbSets for all geographic entities, applying configurations and seed data via OnModelCreating. |
> | [GeoDbContextFactory.cs](Repository/GeoDbContextFactory.cs) | Design-time factory enabling EF Core tooling (migrations) without requiring a running application or Aspire host.         |
>
> ### Entities
>
> Entity Framework Core configurations using `IEntityTypeConfiguration<T>` for explicit table/column mappings with snake_case naming.
>
> | File Name                                                                          | Description                                                                                                           |
> |------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
> | [CountryConfig.cs](Repository/Entities/CountryConfig.cs)                           | Country entity configuration with ISO 3166-1 keys, FK relationships to Currency/Locale, and many-to-many navigations. |
> | [CurrencyConfig.cs](Repository/Entities/CurrencyConfig.cs)                         | Currency entity configuration with ISO 4217 primary key and decimal places/symbol columns.                            |
> | [GeopoliticalEntityConfig.cs](Repository/Entities/GeopoliticalEntityConfig.cs)     | GeopoliticalEntity configuration with ShortCode PK, enum-to-string Type conversion, and Country many-to-many.         |
> | [LanguageConfig.cs](Repository/Entities/LanguageConfig.cs)                         | Language entity configuration with ISO 639-1 primary key and endonym column.                                          |
> | [LocaleConfig.cs](Repository/Entities/LocaleConfig.cs)                             | Locale entity configuration with IETF BCP 47 tag PK and FKs to Language/Country.                                      |
> | [ReferenceDataVersion.cs](Repository/Entities/ReferenceDataVersion.cs)             | Infrastructure entity tracking reference data version for cache invalidation.                                         |
> | [ReferenceDataVersionConfig.cs](Repository/Entities/ReferenceDataVersionConfig.cs) | ReferenceDataVersion configuration with Version PK and timestamptz UpdatedAt column.                                  |
> | [SubdivisionConfig.cs](Repository/Entities/SubdivisionConfig.cs)                   | Subdivision entity configuration with ISO 3166-2 PK and FK to parent Country.                                         |
>
> ### Handlers
>
> #### C (Create)
>
> No create handlers yet.
>
> #### D (Delete)
>
> No delete handlers yet.
>
> #### R (Read)
>
> | File Name                                                        | Description                                                                                                                                                                     |
> |------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
> | [GetReferenceData.cs](Repository/Handlers/R/GetReferenceData.cs) | Handler querying all reference data (countries, subdivisions, currencies, languages, locales, geopolitical entities, version) with relationship projections into protobuf DTOs. |
>
> #### U (Update)
>
> No update handlers yet.
>
> ### Migrations
>
> EF Core migrations and tooling scripts for database schema management.
>
> | File Name                                                                              | Description                                                                                    |
> |----------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
> | [__HOW_TO.md](Repository/Migrations/__HOW_TO.md)                                       | Instructions for creating, applying, and rolling back migrations using the provided scripts.   |
> | [_create_migration.bat](Repository/Migrations/_create_migration.bat)                   | Script to generate a new migration with prompted name, using design-time factory.              |
> | [_manually_apply_migrations.bat](Repository/Migrations/_manually_apply_migrations.bat) | Script to apply pending migrations to a specified PostgreSQL instance with connection prompts. |
> | [_rollback_migration.bat](Repository/Migrations/_rollback_migration.bat)               | Script to remove the last migration that hasn't been committed to source control.              |
>
> Migration files (20251123035938_RefDataInit.cs, etc.) are generated by EF Core and not listed individually.
>
> ### Seeding
>
> Extension methods providing comprehensive seed data for geographic reference data using ModelBuilder.
>
> | File Name                                                                                     | Description                                                                                    |
> |-----------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
> | [CountryCurrencySeeding.cs](Repository/Seeding/CountryCurrencySeeding.cs)                     | Seeds country-currency many-to-many relationships (400+ mappings).                             |
> | [CountryGeopoliticalEntitySeeding.cs](Repository/Seeding/CountryGeopoliticalEntitySeeding.cs) | Seeds country-entity many-to-many relationships (1000+ membership entries).                    |
> | [CountrySeeding.cs](Repository/Seeding/CountrySeeding.cs)                                     | Seeds 249 countries with ISO 3166-1 codes, phone prefixes, and sovereignty relationships.      |
> | [CurrencySeeding.cs](Repository/Seeding/CurrencySeeding.cs)                                   | Seeds 5 major currencies (USD, EUR, GBP, CAD, JPY) with ISO 4217 codes and symbols.            |
> | [GeopoliticalEntitySeeding.cs](Repository/Seeding/GeopoliticalEntitySeeding.cs)               | Seeds 53 geopolitical entities (UN, EU, NATO, ASEAN, etc.) with organization types.            |
> | [LanguageSeeding.cs](Repository/Seeding/LanguageSeeding.cs)                                   | Seeds 6 languages (English, Spanish, French, German, Italian, Japanese) with ISO 639-1 codes.  |
> | [LocaleSeeding.cs](Repository/Seeding/LocaleSeeding.cs)                                       | Seeds 100+ locales with IETF BCP 47 tags linking languages to countries.                       |
> | [ReferenceDataVersionSeeding.cs](Repository/Seeding/ReferenceDataVersionSeeding.cs)           | Seeds initial reference data version (1.0.0) for cache versioning.                             |
> | [SubdivisionSeeding.cs](Repository/Seeding/SubdivisionSeeding.cs)                             | Seeds 183 subdivisions for 8 countries (US, CA, GB, DE, FR, JP, IT, ES) with ISO 3166-2 codes. |
