# Geo.Infra

Infrastructure layer for the Geo microservice implementing Entity Framework Core persistence, MassTransit messaging, database configuration, seed data, and repository handlers.

## Files

| File Name                      | Description                                                                                                                                                                                 |
|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [Extensions.cs](Extensions.cs) | DI extension method AddGeoInfra registering GeoDbContext, MassTransit with RabbitMQ, repository handlers, messaging publisher handlers, and UpdatedConsumer from GeoRefDataService.Default. |

---

## Messaging

> ### Handlers
>
> #### Pub (Publishers)
>
> | File Name                                          | Description                                                                                          |
> |----------------------------------------------------|------------------------------------------------------------------------------------------------------|
> | [Update.cs](Messaging/Handlers/Pub/Update.cs)      | Handler for publishing GeoRefDataUpdated messages via UpdatePublisher when reference data changes.   |
>
> #### Sub (Subscribers)
>
> No subscriber handlers - shared subscribers (like Updated from GeoRefDataService.Default) are registered via consumer services.
>
> ### MT (MassTransit)
>
> #### Consumers
>
> No Geo-specific consumers - shared consumers (like UpdatedConsumer from GeoRefDataService.Default) are registered via Extensions.cs.
>
> #### Publishers
>
> | File Name                                                        | Description                                                                                                     |
> |------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
> | [UpdatePublisher.cs](Messaging/MT/Publishers/UpdatePublisher.cs) | MassTransit publisher wrapping IPublishEndpoint for GeoRefDataUpdated messages with error handling and logging. |

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
> | File Name                                                                      | Description                                                                                                             |
> |--------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
> | [CountryConfig.cs](Repository/Entities/CountryConfig.cs)                       | Country entity configuration with ISO 3166-1 keys, FK relationships to Currency/Locale, and many-to-many navigations.   |
> | [SubdivisionConfig.cs](Repository/Entities/SubdivisionConfig.cs)               | Subdivision entity configuration with ISO 3166-2 composite key and Country FK.                                          |
> | [CurrencyConfig.cs](Repository/Entities/CurrencyConfig.cs)                     | Currency entity configuration with ISO 4217 alpha code primary key.                                                     |
> | [LanguageConfig.cs](Repository/Entities/LanguageConfig.cs)                     | Language entity configuration with ISO 639-1 code primary key.                                                          |
> | [LocaleConfig.cs](Repository/Entities/LocaleConfig.cs)                         | Locale entity configuration with IETF BCP-47 tag primary key and Language/Country FKs.                                  |
> | [GeopoliticalEntityConfig.cs](Repository/Entities/GeopoliticalEntityConfig.cs) | GeopoliticalEntity configuration with short code PK and many-to-many Country relationship.                              |
>
> ### Handlers
>
> #### R (Read)
>
> | File Name                                                        | Description                                                                                                    |
> |------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
> | [GetReferenceData.cs](Repository/Handlers/R/GetReferenceData.cs) | Handler retrieving all geographic reference data (countries, subdivisions, currencies, etc.) as protobuf DTOs. |
>
> ### Migrations
>
> EF Core migrations for schema evolution.
>
> ### Seeding
>
> Seed data classes for geographic reference data initialization.
>
> | File Name                                                                        | Description                                                 |
> |----------------------------------------------------------------------------------|-------------------------------------------------------------|
> | [CountrySeedData.cs](Repository/Seeding/CountrySeeding.cs)                       | 249 countries with ISO codes, phone prefixes, and metadata. |
> | [SubdivisionSeedData.cs](Repository/Seeding/SubdivisionSeeding.cs)               | 183 subdivisions (US states, Canadian provinces, etc.).     |
> | [CurrencySeedData.cs](Repository/Seeding/CurrencySeeding.cs)                     | Major world currencies with ISO 4217 codes and symbols.     |
> | [LanguageSeedData.cs](Repository/Seeding/LanguageSeeding.cs)                     | Common languages with ISO 639-1 codes.                      |
> | [LocaleSeedData.cs](Repository/Seeding/LocaleSeeding.cs)                         | 100+ locales with IETF BCP-47 tags.                         |
> | [GeopoliticalEntitySeedData.cs](Repository/Seeding/GeopoliticalEntitySeeding.cs) | Organizations like NATO, EU, UN with member countries.      |
