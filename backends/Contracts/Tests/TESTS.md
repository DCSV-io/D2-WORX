# Tests

Integration and unit tests for contracts infrastructure using Testcontainers for real Redis validation. Verifies cache implementations, extensions, and error handling.

## Files

| File Name                                                      | Description                                                                                                                                                                                                             |
|----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [TestHelpers.cs](TestHelpers.cs)                               | Test utilities creating mock IHandlerContext and IRequestContext instances with test trace IDs for handler testing.                                                                                                     |
| [D2ResultTests.cs](D2ResultTests.cs)                           | Unit tests for non-generic D2Result class verifying factory methods (Ok, Fail, ValidationFailed, NotFound, Forbidden, Unauthorized, Conflict, UnhandledException) with proper status codes, error codes, and trace IDs. |
| [D2ResultGenericTests.cs](D2ResultGenericTests.cs)             | Unit tests for generic D2Result<TData> class testing factory methods with data payloads, CheckSuccess/CheckFailure helper methods for pattern matching, and BubbleFail for error propagation across result types.       |
| [DefaultMemoryCacheTests.cs](DefaultMemoryCacheTests.cs)       | Unit tests for DefaultMemoryCacheService verifying Get (missing/existing keys), Set (with/without expiration and TTL validation), and Remove operations using IMemoryCache.                                             |
| [RedisDistributedCacheTests.cs](RedisDistributedCacheTests.cs) | Integration tests using Testcontainers.Redis to validate Set/Get/Remove/Exists operations with real Redis instance, JSON serialization, and TTL expiration.                                                             |
| [StringExtensionsTests.cs](StringExtensionsTests.cs)           | Unit tests verifying Truthy/Falsey, CleanStr normalization, email validation, phone number cleaning, and hash string generation.                                                                                        |
| [EnumerableExtensionsTests.cs](EnumerableExtensionsTests.cs)   | Unit tests for collection Truthy/Falsey checks and Clean operations with various null handling and empty enumerable behaviors.                                                                                          |
| [GuidExtensionsTests.cs](GuidExtensionsTests.cs)               | Unit tests validating GUID Truthy/Falsey behavior for both nullable and non-nullable GUIDs, including empty and default values.                                                                                         |
