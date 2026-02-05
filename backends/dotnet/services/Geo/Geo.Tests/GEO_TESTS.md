# Geo.Tests

Integration and unit tests for Geo domain entities, value objects, and infrastructure layer. Tests content-addressable hashing, immutability constraints, validation rules, entity relationships, and messaging infrastructure.

## Fixtures

Shared test fixtures using xUnit's `ICollectionFixture<T>` pattern to reduce PostgreSQL container startup overhead. Tests in a collection share a single container instance.

| File Name                                                            | Description                                                                                                        |
|----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| [SharedPostgresFixture.cs](Fixtures/SharedPostgresFixture.cs)        | Shared PostgreSQL container fixture with migrations. Creates fresh DbContext per test for isolation.               |
| [SharedPostgresCollection.cs](Fixtures/SharedPostgresCollection.cs)  | Collection definition for tests that can safely share a container (use unique/generated data).                     |
| [ReferenceDataCollection.cs](Fixtures/ReferenceDataCollection.cs)    | Collection definition for tests that depend on pristine reference/seed data counts (249 countries, etc.).          |

**Usage:** Apply `[Collection("SharedPostgres")]` or `[Collection("ReferenceData")]` to test classes and inject `SharedPostgresFixture` via constructor.

## Integration Tests

### App

#### CQRS

| File Name                                                                    | Description                                                                                                                                       |
|------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| [GetTests.cs](Integration/App/GetTests.cs)                                   | Integration tests for publisher-side Get handler verifying multi-tier cache cascade, DB fetch with notification, SetInDist failure handling.      |
| [GetLocationsByIdsTests.cs](Integration/App/GetLocationsByIdsTests.cs)       | Integration tests for GetLocationsByIds CQRS handler verifying memory cache → repository fallback, SOME_FOUND/NOT_FOUND propagation.              |
| [GetWhoIsByIdsTests.cs](Integration/App/GetWhoIsByIdsTests.cs)               | Integration tests for GetWhoIsByIds CQRS handler verifying memory cache → repository fallback, DTO mapping, nested Location enrichment, and SOME_FOUND/NOT_FOUND propagation.     |
| [GetContactsByIdsTests.cs](Integration/App/GetContactsByIdsTests.cs)         | Integration tests for GetContactsByIds CQRS handler verifying memory cache → repository fallback, DTO mapping, nested Location enrichment, and SOME_FOUND/NOT_FOUND propagation.  |
| [GetContactsByExtKeysTests.cs](Integration/App/GetContactsByExtKeysTests.cs) | Integration tests for GetContactsByExtKeys CQRS handler verifying lookup by ContextKey/RelatedEntityId with nested Location enrichment and SOME_FOUND/NOT_FOUND propagation.      |
| [CreateLocationsTests.cs](Integration/App/CreateLocationsTests.cs)           | Integration tests for CreateLocations CQRS handler verifying batch creation with deduplication and cache population.                              |
| [CreateWhoIsTests.cs](Integration/App/CreateWhoIsTests.cs)                   | Integration tests for CreateWhoIs CQRS handler verifying batch creation with deduplication and cache population.                                  |
| [CreateContactsTests.cs](Integration/App/CreateContactsTests.cs)             | Integration tests for CreateContacts CQRS handler verifying batch creation with embedded locations, nested Location in response, and cache population. |
| [DeleteContactsTests.cs](Integration/App/DeleteContactsTests.cs)             | Integration tests for DeleteContacts CQRS handler verifying batch deletion with cache invalidation and idempotency.                               |
| [FindWhoIsTests.cs](Integration/App/FindWhoIsTests.cs)                       | Integration tests for FindWhoIs complex handler verifying cache check → external API → create flow with nested Location enrichment and partial success handling. |

### Client

| File Name                                                                                     | Description                                                                                                                           |
|-----------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| [GeoRefDataProviderTests.cs](Integration/Client/GeoRefDataProviderTests.cs)                    | Integration tests using Testcontainers.Redis to verify provider-side SetInDist handler stores and overwrites data in Redis correctly. |
| [GeoRefDataTests.cs](Integration/Client/GeoRefDataTests.cs)                                    | Integration tests using Testcontainers.Redis to verify multi-tier cache behavior: memory/Redis/disk cascade and cache population.     |

### Infra

#### Repository

| File Name                                                                                  | Description                                                                                                                                 |
|--------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| [GetReferenceDataTests.cs](Integration/Infra/Repository/Handlers/GetReferenceDataTests.cs) | Integration tests using Testcontainers.PostgreSql to verify GetReferenceData handler returns all seeded reference data with correct counts. |
| [LocationHandlerTests.cs](Integration/Infra/Repository/Handlers/LocationHandlerTests.cs)   | Integration tests for GetLocationsByIds and CreateLocations repository handlers with OK/SOME_FOUND/NOT_FOUND status verification.           |
| [WhoIsHandlerTests.cs](Integration/Infra/Repository/Handlers/WhoIsHandlerTests.cs)         | Integration tests for GetWhoIsByIds and CreateWhoIs repository handlers with batching, deduplication, and status code verification.         |
| [BatchQueryTests.cs](Integration/Infra/Repository/BatchQueryTests.cs)                      | Integration tests for BatchQuery<TEntity,TKey> verifying ToListAsync batching, GetMissingIdsAsync, and BatchCount configuration.            |

## Unit Tests

### App

#### Mappers

| File Name                                                         | Description                                                                                                           |
|-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| [LocationMapperTests.cs](Unit/App/Mappers/LocationMapperTests.cs) | Unit tests for LocationMapper verifying ToDTO/ToDomain conversions with full and minimal Location data.               |
| [ContactMapperTests.cs](Unit/App/Mappers/ContactMapperTests.cs)   | Unit tests for ContactMapper verifying ToDTO/ToDomain conversions with nested value objects (Personal, Professional). |
| [WhoIsMapperTests.cs](Unit/App/Mappers/WhoIsMapperTests.cs)       | Unit tests for WhoIsMapper verifying ToDTO/ToDomain conversions with LocationHashId FK handling.                      |

### Domain

#### Entities

| File Name                                                 | Description                                                                                                             |
|-----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| [ContactTests.cs](Unit/Domain/Entities/ContactTests.cs)   | Tests validating Contact creation, ContextKey/RelatedEntityId patterns, value object nesting, and LocationHashId FK.    |
| [LocationTests.cs](Unit/Domain/Entities/LocationTests.cs) | Tests verifying Location SHA-256 hash generation, content-addressable deduplication, and hash consistency.              |
| [WhoIsTests.cs](Unit/Domain/Entities/WhoIsTests.cs)       | Tests confirming WhoIs hash generation from IP+year+month+fingerprint, temporal versioning, and device differentiation. |

#### Exceptions

| File Name                                                                       | Description                                                                                                       |
|---------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| [GeoDomainExceptionTests.cs](Unit/Domain/Exceptions/GeoDomainExceptionTests.cs) | Tests covering GeoValidationException message formatting and GeoDomainException inner exception constructor path. |

#### ValueObjects

| File Name                                                                 | Description                                                                                                                                       |
|---------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| [ContactMethodsTests.cs](Unit/Domain/ValueObjects/ContactMethodsTests.cs) | Tests validating collection requirements, nested validation, PrimaryEmail/PrimaryPhone properties, GetHashCode, and Equals edge cases.            |
| [CoordinatesTests.cs](Unit/Domain/ValueObjects/CoordinatesTests.cs)       | Tests validating lat/long range constraints, 5-decimal precision quantization, and immutability enforcement.                                      |
| [EmailAddressTests.cs](Unit/Domain/ValueObjects/EmailAddressTests.cs)     | Tests verifying email validation, lowercase normalization, label handling, Create from existing, GetHashCode, and Equals edge cases.              |
| [PersonalTests.cs](Unit/Domain/ValueObjects/PersonalTests.cs)             | Tests validating Personal creation with FirstName requirement, enum properties, DateOnly validation, GetHashCode, and Equals edge cases.          |
| [PhoneNumberTests.cs](Unit/Domain/ValueObjects/PhoneNumberTests.cs)       | Tests checking phone digit extraction, length validation (7-15 digits), label handling, Create from existing, GetHashCode, and Equals edge cases. |
| [ProfessionalTests.cs](Unit/Domain/ValueObjects/ProfessionalTests.cs)     | Tests verifying Professional with required CompanyName, optional properties, Uri validation, and whitespace normalization.                        |
| [StreetAddressTests.cs](Unit/Domain/ValueObjects/StreetAddressTests.cs)   | Tests verifying 3-line address validation, Line3 dependency on Line2, whitespace cleaning, and immutability.                                      |

### Client

| File Name                                                                                                  | Description                                                                                                           |
|------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| [GeoRefDataUnitTests.cs](Unit/Client/GeoRefDataUnitTests.cs)                                               | Unit tests for Geo.Client handler implementations: SetInMem, GetFromMem, SetOnDisk, GetFromDisk, ReqUpdate, Get.    |
| [GetRefDataResSerializationTests.cs](Unit/Client/GetRefDataResSerializationTests.cs)                        | Tests verifying protobuf binary serialization/deserialization of GetReferenceDataResponse for Redis caching.          |

### Infra

#### Messaging

| File Name                                                               | Description                                                                                                                |
|-------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| [UpdatePublisherTests.cs](Unit/Infra/Messaging/UpdatePublisherTests.cs) | Tests for UpdatePublisher verifying IPublishEndpoint integration, exception handling, cancellation token propagation.      |
| [UpdateTests.cs](Unit/Infra/Messaging/UpdateTests.cs)                   | Tests for Update handler verifying message publishing, version passthrough, success/failure handling via mocked publisher. |

#### Repository

| File Name                                                                    | Description                                                                                                                            |
|------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| [SeedDataIntegrityTests.cs](Unit/Infra/Repository/SeedDataIntegrityTests.cs) | Tests verifying seed data referential integrity: countries reference valid currencies/locales, subdivisions reference valid countries. |

#### WhoIs

| File Name                                             | Description                                                                                                                           |
|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| [PopulateTests.cs](Unit/Infra/WhoIs/PopulateTests.cs) | Tests for Populate handler verifying IIpInfoClient mocking, ASN parsing, location extraction, deduplication, and coordinate handling. |
