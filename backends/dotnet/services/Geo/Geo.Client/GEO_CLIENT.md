# Geo.Client

Service-owned client library for the Geo microservice. Contains messages, handler interfaces, and default implementations that consumer services depend on for geographic reference data operations (multi-tier caching, disk persistence, gRPC requests, and messaging).

## Files

| File Name                                  | Description                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| [Extensions.cs](Extensions.cs)             | DI extension methods: `AddGeoRefDataConsumer`, `AddGeoRefDataProvider`, `AddWhoIsCache`, `AddContactHandlers`.                       |
| [GeoClientOptions.cs](GeoClientOptions.cs) | Configuration options for WhoIs cache, contact cache, `AllowedContextKeys`, and `ApiKey` for gRPC authentication.                    |
| [Geo.Client.csproj](Geo.Client.csproj)     | Project file with dependencies on Handler, Interfaces, Result.Extensions, Utilities, Grpc.Net.ClientFactory, and Messaging.RabbitMQ. |

---

## Data Redaction

Geo.Client handlers deal with sensitive data (IP addresses, user agents, geographic coordinates) and proto-generated DTOs that cannot be annotated with `[RedactData]`. Two complementary mechanisms protect against PII leaks in logs:

### DefaultOptions Overrides

Most handlers suppress I/O logging entirely via `DefaultOptions` because their input/output contains proto-generated `GetReferenceDataResponse` (large, un-annotatable):

| Handler                 | LogInput    | LogOutput   | Rationale                                                  |
| ----------------------- | ----------- | ----------- | ---------------------------------------------------------- |
| SetInMem                | `false`     | `false`     | Input is `GetReferenceDataResponse` (proto-generated)      |
| SetInDist               | `false`     | `false`     | Input is `GetReferenceDataResponse` (proto-generated)      |
| SetOnDisk               | `false`     | `false`     | Input is `GetReferenceDataResponse` (proto-generated)      |
| GetFromMem              | `false`     | `false`     | Output is `GetReferenceDataResponse` (proto-generated)     |
| GetFromDist             | `false`     | `false`     | Output is `GetReferenceDataResponse` (proto-generated)     |
| GetFromDisk             | `false`     | `false`     | Output is `GetReferenceDataResponse` (proto-generated)     |
| Get                     | `false`     | `false`     | Orchestrates all above, same proto data flows through      |
| FindWhoIs               | `true`      | `false`     | Input annotated with `[RedactData]`; output is proto WhoIs |
| ReqUpdate               | _(default)_ | _(default)_ | I/O is empty / non-sensitive                               |
| CreateContacts          | `false`     | `false`     | Input/output contains contact PII (proto-generated)        |
| DeleteContactsByExtKeys | _(default)_ | _(default)_ | I/O is ext keys / counts (non-sensitive)                   |
| GetContactsByExtKeys    | _(default)_ | `false`     | Output contains contact PII (proto-generated)              |
| UpdateContactsByExtKeys | `false`     | `false`     | Input/output contains contact PII (proto-generated)        |

### [RedactData] Annotations

`FindWhoIsInput` has property-level `[RedactData]` on its sensitive fields, processed by `RedactDataDestructuringPolicy` during Serilog destructuring:

```csharp
public record FindWhoIsInput(
    [property: RedactData(Reason = RedactReason.PersonalInformation)] string IpAddress,
    [property: RedactData(Reason = RedactReason.PersonalInformation)] string UserAgent);
```

This allows input logging to remain enabled (useful for debugging) while ensuring PII is masked in log output.

---

## Interfaces

> ### CQRS
>
> #### Handlers
>
> ##### C (Commands)
>
> | File Name                                                                                               | Description                                                                                                             |
> | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
> | [ICommands.cs](Interfaces/CQRS/Handlers/C/ICommands.cs)                                                 | Partial interface defining command operations for geographic reference data state-changing operations.                  |
> | [ICommands.ReqUpdate.cs](Interfaces/CQRS/Handlers/C/ICommands.ReqUpdate.cs)                             | Extends ICommands with IReqUpdateHandler for requesting reference data updates via gRPC.                                |
> | [ICommands.SetInDist.cs](Interfaces/CQRS/Handlers/C/ICommands.SetInDist.cs)                             | Extends ICommands with ISetInDistHandler for storing reference data in Redis distributed cache.                         |
> | [ICommands.SetInMem.cs](Interfaces/CQRS/Handlers/C/ICommands.SetInMem.cs)                               | Extends ICommands with ISetInMemHandler for storing reference data in memory cache.                                     |
> | [ICommands.SetOnDisk.cs](Interfaces/CQRS/Handlers/C/ICommands.SetOnDisk.cs)                             | Extends ICommands with ISetOnDiskHandler for persisting reference data to disk.                                         |
> | [ICommands.CreateContacts.cs](Interfaces/CQRS/Handlers/C/ICommands.CreateContacts.cs)                   | Extends ICommands with ICreateContactsHandler for creating Geo contacts via gRPC. Validates `AllowedContextKeys`.       |
> | [ICommands.DeleteContactsByExtKeys.cs](Interfaces/CQRS/Handlers/C/ICommands.DeleteContactsByExtKeys.cs) | Extends ICommands with IDeleteContactsByExtKeysHandler for deleting Geo contacts by ext keys via gRPC + cache eviction. |
>
> ##### Q (Queries)
>
> | File Name                                                                                       | Description                                                                                                  |
> | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
> | [IQueries.cs](Interfaces/CQRS/Handlers/Q/IQueries.cs)                                           | Partial interface defining query operations for geographic reference data read-only operations.              |
> | [IQueries.GetFromDisk.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetFromDisk.cs)                   | Extends IQueries with IGetFromDiskHandler for retrieving reference data from disk storage.                   |
> | [IQueries.GetFromDist.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetFromDist.cs)                   | Extends IQueries with IGetFromDistHandler for retrieving reference data from Redis.                          |
> | [IQueries.GetFromMem.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetFromMem.cs)                     | Extends IQueries with IGetFromMemHandler for retrieving reference data from memory cache.                    |
> | [IQueries.GetContactsByExtKeys.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetContactsByExtKeys.cs) | Extends IQueries with IGetContactsByExtKeysHandler for fetching contacts by ext keys with local cache-aside. |
>
> ##### X (Complex)
>
> | File Name                                                                                             | Description                                                                                               |
> | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
> | [IComplex.cs](Interfaces/CQRS/Handlers/X/IComplex.cs)                                                 | Partial interface defining complex operations for geographic reference data operations with side effects. |
> | [IComplex.Get.cs](Interfaces/CQRS/Handlers/X/IComplex.Get.cs)                                         | Extends IComplex with IGetHandler for orchestrating multi-tier cache retrieval with fallback chain.       |
> | [IComplex.FindWhoIs.cs](Interfaces/CQRS/Handlers/X/IComplex.FindWhoIs.cs)                             | Extends IComplex with IFindWhoIsHandler for WhoIs lookup with local caching and gRPC fallback.            |
> | [IComplex.UpdateContactsByExtKeys.cs](Interfaces/CQRS/Handlers/X/IComplex.UpdateContactsByExtKeys.cs) | Extends IComplex with IUpdateContactsByExtKeysHandler for replacing contacts at ext keys via gRPC.        |

> ### Messaging
>
> #### Handlers
>
> ##### Sub (Subscribers)
>
> | File Name                                                              | Description                                                                                 |
> | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
> | [ISubs.cs](Interfaces/Messaging/Handlers/Sub/ISubs.cs)                 | Partial interface defining subscription operations for geographic reference data messaging. |
> | [ISubs.Updated.cs](Interfaces/Messaging/Handlers/Sub/ISubs.Updated.cs)               | Extends ISubs with IUpdatedHandler for processing GeoRefDataUpdatedEvent events.              |
> | [ISubs.ContactsEvicted.cs](Interfaces/Messaging/Handlers/Sub/ISubs.ContactsEvicted.cs) | Extends ISubs with IContactsEvictedHandler for processing ContactsEvictedEvent cache eviction. |

---

## CQRS

> ### Handlers
>
> #### C (Commands)
>
> | File Name                                                                | Description                                                                                                  |
> | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
> | [ReqUpdate.cs](CQRS/Handlers/C/ReqUpdate.cs)                             | Handler requesting reference data update from Geo service via gRPC, returning the response.                  |
> | [SetInDist.cs](CQRS/Handlers/C/SetInDist.cs)                             | Handler storing serialized GetReferenceDataResponse in Redis distributed cache with configurable expiration. |
> | [SetInMem.cs](CQRS/Handlers/C/SetInMem.cs)                               | Handler storing GetReferenceDataResponse in memory cache with configurable expiration.                       |
> | [SetOnDisk.cs](CQRS/Handlers/C/SetOnDisk.cs)                             | Handler persisting serialized GetReferenceDataResponse to a local file for disk-tier fallback.               |
> | [CreateContacts.cs](CQRS/Handlers/C/CreateContacts.cs)                   | Handler creating Geo contacts via gRPC. Validates `AllowedContextKeys`. PII redacted.                        |
> | [DeleteContactsByExtKeys.cs](CQRS/Handlers/C/DeleteContactsByExtKeys.cs) | Handler deleting Geo contacts by ext keys via gRPC + evicting from local IMemoryCache.                       |
>
> #### Q (Queries)
>
> | File Name                                                          | Description                                                                                                      |
> | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
> | [GetFromDisk.cs](CQRS/Handlers/Q/GetFromDisk.cs)                   | Handler retrieving GetReferenceDataResponse from disk by deserializing the persisted protobuf file.              |
> | [GetFromDist.cs](CQRS/Handlers/Q/GetFromDist.cs)                   | Handler retrieving GetReferenceDataResponse from Redis distributed cache.                                        |
> | [GetFromMem.cs](CQRS/Handlers/Q/GetFromMem.cs)                     | Handler retrieving GetReferenceDataResponse from memory cache.                                                   |
> | [GetContactsByExtKeys.cs](CQRS/Handlers/Q/GetContactsByExtKeys.cs) | Handler fetching Geo contacts by ext keys with local cache-aside (immutable, no TTL). Fail-open on gRPC failure. |
>
> #### X (Complex)
>
> | File Name                                                                | Description                                                                                                                     |
> | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
> | [Get.cs](CQRS/Handlers/X/Get.cs)                                         | Orchestrator handler implementing multi-tier cache fallback: Memory → Redis → Disk → gRPC, populating higher tiers on miss.     |
> | [FindWhoIs.cs](CQRS/Handlers/X/FindWhoIs.cs)                             | Handler for WhoIs lookups with local IMemoryCache caching and Geo gRPC service fallback. Used by request enrichment middleware. |
> | [UpdateContactsByExtKeys.cs](CQRS/Handlers/X/UpdateContactsByExtKeys.cs) | Handler replacing contacts at ext keys via gRPC (atomic delete + create) + ext-key cache eviction. PII redacted.                |

---

## Messaging

> ### Handlers
>
> #### Sub (Subscribers)
>
> | File Name                                       | Description                                                                                                         |
> | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
> | [Updated.cs](Messaging/Handlers/Sub/Updated.cs)               | Handler processing GeoRefDataUpdatedEvent events by requesting fresh data from Geo service and updating all caches.          |
> | [ContactsEvicted.cs](Messaging/Handlers/Sub/ContactsEvicted.cs) | Handler processing ContactsEvictedEvent by evicting matching contact IDs and ext-keys from the local in-memory cache. |
>
> ### Consumers
>
> | File Name                                                                  | Description                                                                                                  |
> | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
> | [UpdatedConsumerService.cs](Messaging/Consumers/UpdatedConsumerService.cs)                       | BackgroundService hosting a ProtoConsumer<GeoRefDataUpdatedEvent> that delegates to the Updated sub handler.                                                        |
> | [ContactEvictionConsumerService.cs](Messaging/Consumers/ContactEvictionConsumerService.cs) | BackgroundService hosting a broadcast ProtoConsumer<ContactsEvictedEvent> (exclusive auto-delete queue per instance) that delegates to the ContactsEvicted handler. |

---

## Security — API Key + Context Key Validation

Contacts are only accessible externally via ext keys (`contextKey` + `relatedEntityId`). ID-based get/delete are removed from client libraries (proto RPCs remain for Geo's internal use).

### Defense-in-Depth Layers

| Layer                 | Mechanism                                        | Enforced By                                           |
| --------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| **Transport**         | gRPC metadata `x-api-key` header                 | Client `CallCredentials` + Geo.API server interceptor |
| **Ownership**         | API key → allowed context keys mapping           | Geo.API `ApiKeyInterceptor` (server-side)             |
| **Client validation** | `AllowedContextKeys` in `GeoClientOptions`       | All contact handlers (defense-in-depth)               |
| **Access pattern**    | Ext-key-only (no PK-based get/delete externally) | Client library (ID handlers removed)                  |

### Cache Key Conventions

| Cache Key Pattern                            | Value          | Populated By         | Evicted By                                       |
| -------------------------------------------- | -------------- | -------------------- | ------------------------------------------------ |
| `contact-ext:{contextKey}:{relatedEntityId}` | `ContactDTO[]` | GetContactsByExtKeys | DeleteContactsByExtKeys, UpdateContactsByExtKeys |

Single `IMemoryCache` instance. No TTL — contacts are immutable.

---

## Validators

Reusable FluentValidation validators for proto-generated DTOs, exported as single source of truth. Any service creating contacts via Geo should compose these via `.SetValidator()` instead of duplicating rules.

| File Name                                                             | Description                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ContactToCreateValidator.cs](Validators/ContactToCreateValidator.cs) | Aggregate validator for `ContactToCreateDTO`. Mirrors Geo domain factory constraints (names 255, company 255, website 2048, emails, phones). Supports indexed property names for bulk validation. |

---

## .NET-Specific Notes

- `AddContactHandlers` in `Extensions.cs` registers ext-key handlers and configures `CallCredentials` for the gRPC channel to inject `x-api-key` from `GeoClientOptions.ApiKey`
- `GeoAppOptions.ApiKeyMappings` (server-side, in Geo.API) maps each API key to its allowed context keys
- `ApiKeyInterceptor` in Geo.API validates API key + context keys on all contact RPCs

---

## TS Equivalent

`@d2/geo-client` — same interface + handler structure, `RedactionSpec` for logging suppression, field-level masking on `FindWhoIs` inputs. Zod schemas (`contactInputSchema` etc.) exported for the same reuse pattern.
