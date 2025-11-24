# Geo.Infra

Infrastructure layer for the Geo microservice implementing Entity Framework Core persistence, database configuration, seed data, and repository handlers.

## Files

| File Name                       | Description                                                                                                          |
|---------------------------------|----------------------------------------------------------------------------------------------------------------------|
| [Extensions.cs](Extensions.cs)  | DI extension methods registering GeoDbContext and repository handlers with explicit connection string configuration. |

## Repository

| File Name                                                   | Description                                                                                                               |
|-------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| [GeoDbContext.cs](Repository/GeoDbContext.cs)               | EF Core DbContext exposing DbSets for all geographic entities, applying configurations and seed data via OnModelCreating. |
| [GeoDbContextFactory.cs](Repository/GeoDbContextFactory.cs) | Design-time factory enabling EF Core tooling (migrations) without requiring a running application or Aspire host.         |

### Repository/Entities

Entity Framework Core configurations using `IEntityTypeConfiguration<T>` for explicit table/column mappings with snake_case naming.

| File Name                                                                          | Description                                                                                                           |
|------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| [CountryConfig.cs](Repository/Entities/CountryConfig.cs)                           | Country entity configuration with ISO 3166-1 keys, FK relationships to Currency/Locale, and many-to-many navigations. |
| [CurrencyConfig.cs](Repository/Entities/CurrencyConfig.cs)                         | Currency entity configuration with ISO 4217 primary key and decimal places/symbol columns.                            |
| [GeopoliticalEntityConfig.cs](Repository/Entities/GeopoliticalEntityConfig.cs)     | GeopoliticalEntity configuration with ShortCode PK, enum-to-string Type conversion, and Country many-to-many.         |
| [LanguageConfig.cs](Repository/Entities/LanguageConfig.cs)                         | Language entity configuration with ISO 639-1 primary key and endonym column.                                          |
| [LocaleConfig.cs](Repository/Entities/LocaleConfig.cs)                             | Locale entity configuration with IETF BCP 47 tag PK and FKs to Language/Country.                                      |
| [ReferenceDataVersion.cs](Repository/Entities/ReferenceDataVersion.cs)             | Infrastructure entity tracking reference data version for cache invalidation.                                         |
| [ReferenceDataVersionConfig.cs](Repository/Entities/ReferenceDataVersionConfig.cs) | ReferenceDataVersion configuration with Version PK and timestamptz UpdatedAt column.                                  |
| [SubdivisionConfig.cs](Repository/Entities/SubdivisionConfig.cs)                   | Subdivision entity configuration with ISO 3166-2 PK and FK to parent Country.                                         |

### Repository/Handlers

CQRS-style handlers organized by operation type (C=Create, R=Read, U=Update, D=Delete).

| File Name                                                        | Description                                                                                                                                                                 |
|------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [GetReferenceData.cs](Repository/Handlers/R/GetReferenceData.cs) | Read handler querying all reference data (countries, subdivisions, currencies, languages, locales, geopolitical entities) with relationship projections into protobuf DTOs. |

### Repository/Migrations

EF Core migrations and tooling scripts. See [Migrations/](Repository/Migrations) for individual migration files.

| File Name                                                                              | Description                                                                                    |
|----------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| [__HOW_TO.md](Repository/Migrations/__HOW_TO.md)                                       | Instructions for creating, applying, and rolling back migrations using the provided scripts.   |
| [_create_migration.bat](Repository/Migrations/_create_migration.bat)                   | Script to generate a new migration with prompted name, using design-time factory.              |
| [_manually_apply_migrations.bat](Repository/Migrations/_manually_apply_migrations.bat) | Script to apply pending migrations to a specified PostgreSQL instance with connection prompts. |
| [_rollback_migration.bat](Repository/Migrations/_rollback_migration.bat)               | Script to revert to a previous migration by name.                                              |
| [GeoDbContextModelSnapshot.cs](Repository/Migrations/GeoDbContextModelSnapshot.cs)     | EF Core model snapshot tracking current schema state for migration diffing.                    |

### Repository/Seeding

Seed data extensions for reference data, invoked during OnModelCreating via `HasData()`.

| File Name                                                                                     | Description                                                                                              |
|-----------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| [ReferenceDataVersionSeeding.cs](Repository/Seeding/ReferenceDataVersionSeeding.cs)           | Seeds initial version record (v1.2.0) for cache invalidation tracking.                                   |
| [LanguageSeeding.cs](Repository/Seeding/LanguageSeeding.cs)                                   | Seeds 6 primary languages (en, es, fr, de, ja, zh) with ISO 639-1 codes and endonyms.                    |
| [CurrencySeeding.cs](Repository/Seeding/CurrencySeeding.cs)                                   | Seeds 5 major currencies (USD, EUR, GBP, JPY, CAD) with ISO 4217 codes, symbols, and decimal places.     |
| [CountrySeeding.cs](Repository/Seeding/CountrySeeding.cs)                                     | Seeds 249 countries/territories with ISO 3166-1 codes, names, phone prefixes, and sovereignty relations. |
| [CountryCurrencySeeding.cs](Repository/Seeding/CountryCurrencySeeding.cs)                     | Seeds country-currency many-to-many relationships (88 entries).                                          |
| [GeopoliticalEntitySeeding.cs](Repository/Seeding/GeopoliticalEntitySeeding.cs)               | Seeds 53 geopolitical entities (UN, NATO, EU, G7, trade blocs, regional groups).                         |
| [CountryGeopoliticalEntitySeeding.cs](Repository/Seeding/CountryGeopoliticalEntitySeeding.cs) | Seeds country-entity many-to-many relationships (1000+ membership entries).                              |
| [LocaleSeeding.cs](Repository/Seeding/LocaleSeeding.cs)                                       | Seeds 100+ locales with IETF BCP 47 tags linking languages to countries.                                 |
| [SubdivisionSeeding.cs](Repository/Seeding/SubdivisionSeeding.cs)                             | Seeds 183 subdivisions for 8 countries (US, CA, GB, DE, FR, JP, IT, ES) with ISO 3166-2 codes.           |
