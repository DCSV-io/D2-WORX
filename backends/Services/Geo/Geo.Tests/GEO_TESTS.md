# Geo.Tests

Integration and unit tests for Geo domain entities and value objects. Tests content-addressable hashing, immutability constraints, validation rules, and entity relationships.

## Files

| File Name                                                                                  | Description                                                                                                                                                                  |
|--------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [GetReferenceDataTests.cs](Integration/Infra/Repository/Handlers/GetReferenceDataTests.cs) | Integration tests using Testcontainers.PostgreSql to verify GetReferenceData handler returns all seeded reference data with correct counts and relationships.                |
| [LocationTests.cs](Unit/Domain/Entities/LocationTests.cs)                                  | Tests verifying Location SHA-256 hash generation, content-addressable deduplication, and hash consistency across identical property values.                                  |
| [ContactTests.cs](Unit/Domain/Entities/ContactTests.cs)                                    | Tests validating Contact creation, ContextKey/RelatedEntityId patterns, value object nesting, and LocationHashId FK behavior.                                                |
| [WhoIsTests.cs](Unit/Domain/Entities/WhoIsTests.cs)                                        | Tests confirming WhoIs hash generation from IP+year+month+fingerprint, temporal versioning, and device differentiation on shared IPs.                                        |
| [CoordinatesTests.cs](Unit/Domain/ValueObjects/CoordinatesTests.cs)                        | Tests validating lat/long range constraints, 5-decimal precision quantization, and immutability enforcement.                                                                 |
| [StreetAddressTests.cs](Unit/Domain/ValueObjects/StreetAddressTests.cs)                    | Tests verifying 3-line address validation, Line3 dependency on Line2, whitespace cleaning, and immutability.                                                                 |
| [ContactMethodsTests.cs](Unit/Domain/ValueObjects/ContactMethodsTests.cs)                  | Tests validating collection requirements (non-null), nested EmailAddress/PhoneNumber validation, and PrimaryEmail/PrimaryPhone convenience properties.                       |
| [EmailAddressTests.cs](Unit/Domain/ValueObjects/EmailAddressTests.cs)                      | Tests verifying email validation regex, lowercase normalization, whitespace trimming, and label collection behavior.                                                         |
| [PhoneNumberTests.cs](Unit/Domain/ValueObjects/PhoneNumberTests.cs)                        | Tests checking phone digit extraction, length validation (7-15 digits), and label collection handling.                                                                       |
| [PersonalTests.cs](Unit/Domain/ValueObjects/PersonalTests.cs)                              | Tests validating Personal value object creation with FirstName requirement, optional Title/GenerationalSuffix/BiologicalSex enums, DateOnly validation, and string cleaning. |
| [ProfessionalTests.cs](Unit/Domain/ValueObjects/ProfessionalTests.cs)                      | Tests verifying Professional value object with required CompanyName, optional JobTitle/Department/Website (Uri validation), and whitespace normalization.                    |
| [SeedDataIntegrityTests.cs](Unit/Infra/Repository/SeedDataIntegrityTests.cs)               | Tests verifying seed data referential integrity: countries reference valid currencies/locales, join tables reference valid entities, subdivisions reference valid countries. |
