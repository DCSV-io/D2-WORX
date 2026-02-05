# Utilities

Shared utility extensions and helpers used across all contracts and services. Provides environment variable loading, string cleaning, collection operations, GUID validation, and content-addressable hashing.

## Files

| File Name                                                     | Description                                                                                                                                                              |
|---------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [D2Env.cs](D2Env.cs)                                          | Convention-based `.env` file loader. Reads `.env.local` / `.env`, sets original + infrastructure transform (`Parameters__kebab-case`) + options transform (`Section__Property`) per entry. |
| [RedactDataAttribute.cs](Attributes/RedactDataAttribute.cs)   | Attribute marking properties/fields for redaction in logs and telemetry, specifies RedactReason enum and optional custom reason for privacy/security compliance.         |
| [RedactReason.cs](Enums/RedactReason.cs)                      | Enum defining redaction categories: Unspecified, PersonalInformation, FinancialInformation, SecretInformation, VerboseContent, Other.                                    |
| [StringExtensions.cs](Extensions/StringExtensions.cs)         | String utilities with Truthy/Falsey checks, CleanStr whitespace normalization, email/phone validation, and normalized string generation for content-addressable hashing. |
| [EnumerableExtensions.cs](Extensions/EnumerableExtensions.cs) | Collection extensions with Truthy/Falsey checks, Clean operation applying transformation functions with configurable null handling and empty enumerable behavior.        |
| [GuidExtensions.cs](Extensions/GuidExtensions.cs)             | GUID validation extensions checking for null and Guid.Empty states with Truthy/Falsey semantic helpers.                                                                  |
| [SerializerOptions.cs](Serialization/SerializerOptions.cs)    | Reusable System.Text.Json serialization configurations with reference cycle handling for Redis caching.                                                                  |
