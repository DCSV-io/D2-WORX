# Geo.Infra

Infrastructure layer for the Geo microservice implementing Entity Framework Core persistence, raw AMQP messaging with Protocol Buffer contracts, database configuration, seed data, and repository handlers.

## Files

| File Name                                | Description                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Extensions.cs](Extensions.cs)           | DI extension method AddGeoInfra registering GeoDbContext, RabbitMQ messaging (raw AMQP), repository handlers, messaging publisher handlers, and UpdatedConsumerService from Geo.Client. |
| [GeoInfraOptions.cs](GeoInfraOptions.cs) | Options for infrastructure configuration including BatchSize for repository operations.                                                                                                 |

---

## Messaging

> ### Handlers
>
> #### Pub (Publishers)
>
> | File Name                                                       | Description                                                                                                  |
> | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
> | [Update.cs](Messaging/Handlers/Pub/Update.cs)                   | Handler for publishing GeoRefDataUpdatedEvent via UpdatePublisher when reference data changes.               |
> | [ContactEviction.cs](Messaging/Handlers/Pub/ContactEviction.cs) | Handler for publishing ContactsEvictedEvent via ContactEvictionPublisher when contacts are deleted/replaced. |
>
> #### Sub (Subscribers)
>
> No subscriber handlers - shared subscribers (like Updated from Geo.Client) are registered via consumer services.
>
> ### Publishers
>
> | File Name                                                                       | Description                                                                                                         |
> | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
> | [UpdatePublisher.cs](Messaging/Publishers/UpdatePublisher.cs)                   | AMQP publisher wrapping ProtoPublisher for GeoRefDataUpdatedEvent messages with error handling and logging.         |
> | [ContactEvictionPublisher.cs](Messaging/Publishers/ContactEvictionPublisher.cs) | AMQP publisher wrapping ProtoPublisher for ContactsEvictedEvent messages to `events.geo.contacts` fan-out exchange. |
>
> ### Consumers
>
> No Geo-specific consumers — shared consumers (like UpdatedConsumerService from Geo.Client) are registered as hosted services via Extensions.cs.

---

## Repository

> | File Name                                                   | Description                                                                                                               |
> | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
> | [GeoDbContext.cs](Repository/GeoDbContext.cs)               | EF Core DbContext exposing DbSets for all geographic entities, applying configurations and seed data via OnModelCreating. |
> | [GeoDbContextFactory.cs](Repository/GeoDbContextFactory.cs) | Design-time factory enabling EF Core tooling (migrations) without requiring a running application or Aspire host.         |
>
> ### Entities
>
> Entity Framework Core configurations using `IEntityTypeConfiguration<T>` for explicit table/column mappings with snake_case naming.
>
> | File Name                                                                          | Description                                                                                                           |
> | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
> | [CountryConfig.cs](Repository/Entities/CountryConfig.cs)                           | Country entity configuration with ISO 3166-1 keys, FK relationships to Currency/Locale, and many-to-many navigations. |
> | [SubdivisionConfig.cs](Repository/Entities/SubdivisionConfig.cs)                   | Subdivision entity configuration with ISO 3166-2 composite key and Country FK.                                        |
> | [CurrencyConfig.cs](Repository/Entities/CurrencyConfig.cs)                         | Currency entity configuration with ISO 4217 alpha code primary key.                                                   |
> | [LanguageConfig.cs](Repository/Entities/LanguageConfig.cs)                         | Language entity configuration with ISO 639-1 code primary key.                                                        |
> | [LocaleConfig.cs](Repository/Entities/LocaleConfig.cs)                             | Locale entity configuration with IETF BCP-47 tag primary key and Language/Country FKs.                                |
> | [GeopoliticalEntityConfig.cs](Repository/Entities/GeopoliticalEntityConfig.cs)     | GeopoliticalEntity configuration with short code PK and many-to-many Country relationship.                            |
> | [LocationConfig.cs](Repository/Entities/LocationConfig.cs)                         | Location entity configuration with content-addressable HashId PK and owned Coordinates/StreetAddress value objects.   |
> | [WhoIsConfig.cs](Repository/Entities/WhoIsConfig.cs)                               | WhoIs entity configuration with content-addressable HashId PK and LocationHashId FK.                                  |
> | [ContactConfig.cs](Repository/Entities/ContactConfig.cs)                           | Contact entity configuration with ContextKey/RelatedEntityId composite key and owned value objects.                   |
> | [ReferenceDataVersionConfig.cs](Repository/Entities/ReferenceDataVersionConfig.cs) | ReferenceDataVersion entity configuration for tracking seeded data versions.                                          |
> | [ReferenceDataVersion.cs](Repository/Entities/ReferenceDataVersion.cs)             | Entity tracking the version of seeded reference data in the database.                                                 |
>
> ### Handlers
>
> #### C (Create)
>
> | File Name                                                      | Description                                                                                         |
> | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
> | [CreateLocations.cs](Repository/Handlers/C/CreateLocations.cs) | Handler for batch creating Location entities with duplicate detection via content-addressable hash. |
> | [CreateWhoIs.cs](Repository/Handlers/C/CreateWhoIs.cs)         | Handler for batch creating WhoIs entities with duplicate detection via content-addressable hash.    |
> | [CreateContacts.cs](Repository/Handlers/C/CreateContacts.cs)   | Handler for batch creating Contact entities, returning created Contact list.                        |
>
> #### D (Delete)
>
> | File Name                                                                      | Description                                                                                                                    |
> | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
> | [DeleteContacts.cs](Repository/Handlers/D/DeleteContacts.cs)                   | Handler for batch deleting Contact entities by GUID IDs with OK/SOME_FOUND/NOT_FOUND status.                                   |
> | [DeleteContactsByExtKeys.cs](Repository/Handlers/D/DeleteContactsByExtKeys.cs) | Handler for deleting Contact entities by ContextKey/RelatedEntityId pairs, returns count of deleted contacts and ext-key list. |
>
> #### R (Read)
>
> | File Name                                                                | Description                                                                                                    |
> | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
> | [GetReferenceData.cs](Repository/Handlers/R/GetReferenceData.cs)         | Handler retrieving all geographic reference data (countries, subdivisions, currencies, etc.) as protobuf DTOs. |
> | [GetLocationsByIds.cs](Repository/Handlers/R/GetLocationsByIds.cs)       | Handler for batch retrieving Locations by HashIds using BatchQuery with OK/SOME_FOUND/NOT_FOUND status codes.  |
> | [GetWhoIsByIds.cs](Repository/Handlers/R/GetWhoIsByIds.cs)               | Handler for batch retrieving WhoIs by HashIds using BatchQuery with OK/SOME_FOUND/NOT_FOUND status codes.      |
> | [GetContactsByIds.cs](Repository/Handlers/R/GetContactsByIds.cs)         | Handler for batch retrieving Contacts by GUID IDs using BatchQuery with OK/SOME_FOUND/NOT_FOUND status codes.  |
> | [GetContactsByExtKeys.cs](Repository/Handlers/R/GetContactsByExtKeys.cs) | Handler for retrieving Contacts by ContextKey/RelatedEntityId pairs with OK/SOME_FOUND/NOT_FOUND status codes. |
>
> ### Migrations
>
> EF Core migrations for schema evolution.
>
> ### Seeding
>
> Seed data classes for geographic reference data initialization.
>
> | File Name                                                                                     | Description                                                                 |
> | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
> | [CountrySeeding.cs](Repository/Seeding/CountrySeeding.cs)                                     | 249 countries with ISO codes, phone prefixes, and metadata.                 |
> | [SubdivisionSeeding.cs](Repository/Seeding/SubdivisionSeeding.cs)                             | 183 subdivisions (US states, Canadian provinces, etc.).                     |
> | [CurrencySeeding.cs](Repository/Seeding/CurrencySeeding.cs)                                   | Major world currencies with ISO 4217 codes and symbols.                     |
> | [LanguageSeeding.cs](Repository/Seeding/LanguageSeeding.cs)                                   | Common languages with ISO 639-1 codes.                                      |
> | [LocaleSeeding.cs](Repository/Seeding/LocaleSeeding.cs)                                       | 100+ locales with IETF BCP-47 tags.                                         |
> | [GeopoliticalEntitySeeding.cs](Repository/Seeding/GeopoliticalEntitySeeding.cs)               | Organizations like NATO, EU, UN with member countries.                      |
> | [ReferenceDataVersionSeeding.cs](Repository/Seeding/ReferenceDataVersionSeeding.cs)           | Initial version tracking for reference data.                                |
> | [CountryCurrencySeeding.cs](Repository/Seeding/CountryCurrencySeeding.cs)                     | Many-to-many relationship data for country-currency associations.           |
> | [CountryGeopoliticalEntitySeeding.cs](Repository/Seeding/CountryGeopoliticalEntitySeeding.cs) | Many-to-many relationship data for country-geopolitical entity memberships. |

---

## WhoIs

> ### Client Implementation
>
> | File Name                                              | Description                                                                    |
> | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
> | [IpInfoClientWrapper.cs](WhoIs/IpInfoClientWrapper.cs) | Implementation of IIpInfoClient wrapping the IPinfo.io SDK for IP geolocation. |
>
> ### Handlers
>
> #### R (Read)
>
> | File Name                                   | Description                                                                                      |
> | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
> | [Populate.cs](WhoIs/Handlers/R/Populate.cs) | Handler for populating WhoIs records with data from IPinfo.io API, creating Locations as needed. |
