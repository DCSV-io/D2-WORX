# Geo.Tests

Integration and unit tests for Geo domain entities, value objects, and infrastructure layer. Tests content-addressable hashing, immutability constraints, validation rules, entity relationships, and messaging infrastructure.

## Integration Tests

| File Name                                                                                  | Description                                                                                                                                                   |
|--------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [GetReferenceDataTests.cs](Integration/Infra/Repository/Handlers/GetReferenceDataTests.cs) | Integration tests using Testcontainers.PostgreSql to verify GetReferenceData handler returns all seeded reference data with correct counts and relationships. |

## Unit Tests

### Domain

#### Entities

| File Name                                                  | Description                                                                                                                        |
|------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| [ContactTests.cs](Unit/Domain/Entities/ContactTests.cs)    | Tests validating Contact creation, ContextKey/RelatedEntityId patterns, value object nesting, and LocationHashId FK behavior.      |
| [LocationTests.cs](Unit/Domain/Entities/LocationTests.cs)  | Tests verifying Location SHA-256 hash generation, content-addressable deduplication, and hash consistency across identical values. |
| [WhoIsTests.cs](Unit/Domain/Entities/WhoIsTests.cs)        | Tests confirming WhoIs hash generation from IP+year+month+fingerprint, temporal versioning, and device differentiation.            |

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
