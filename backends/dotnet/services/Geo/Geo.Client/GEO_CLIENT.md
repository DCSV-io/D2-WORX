# Geo.Client

Service-owned client library for the Geo microservice. Contains messages, handler interfaces, and default implementations that consumer services depend on for geographic reference data operations (multi-tier caching, disk persistence, gRPC requests, and messaging).

## Files

| File Name                                  | Description                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [Extensions.cs](Extensions.cs)             | DI extension method `AddGeoClient` registering all default handler implementations, MassTransit consumers, and configuration options.      |
| [GeoClientOptions.cs](GeoClientOptions.cs) | Configuration options for WhoIs cache including TTL and maximum entries for LRU eviction.                                                  |
| [Geo.Client.csproj](Geo.Client.csproj)     | Project file with dependencies on Handler, Interfaces, Result.Extensions, Utilities, Grpc.Net.ClientFactory, and MassTransit.Abstractions. |

---

## Data Redaction

Geo.Client handlers deal with sensitive data (IP addresses, user agents, geographic coordinates) and proto-generated DTOs that cannot be annotated with `[RedactData]`. Two complementary mechanisms protect against PII leaks in logs:

### DefaultOptions Overrides

Most handlers suppress I/O logging entirely via `DefaultOptions` because their input/output contains proto-generated `GetReferenceDataResponse` (large, un-annotatable):

| Handler     | LogInput | LogOutput | Rationale                                                  |
| ----------- | -------- | --------- | ---------------------------------------------------------- |
| SetInMem    | `false`  | `false`   | Input is `GetReferenceDataResponse` (proto-generated)      |
| SetInDist   | `false`  | `false`   | Input is `GetReferenceDataResponse` (proto-generated)      |
| SetOnDisk   | `false`  | `false`   | Input is `GetReferenceDataResponse` (proto-generated)      |
| GetFromMem  | `false`  | `false`   | Output is `GetReferenceDataResponse` (proto-generated)     |
| GetFromDist | `false`  | `false`   | Output is `GetReferenceDataResponse` (proto-generated)     |
| GetFromDisk | `false`  | `false`   | Output is `GetReferenceDataResponse` (proto-generated)     |
| Get         | `false`  | `false`   | Orchestrates all above, same proto data flows through      |
| FindWhoIs   | `true`   | `false`   | Input annotated with `[RedactData]`; output is proto WhoIs |
| ReqUpdate   | _(default)_ | _(default)_ | I/O is empty / non-sensitive                            |

### [RedactData] Annotations

`FindWhoIsInput` has property-level `[RedactData]` on its sensitive fields, processed by `RedactDataDestructuringPolicy` during Serilog destructuring:

```csharp
public record FindWhoIsInput(
    [property: RedactData(Reason = RedactReason.PersonalInformation)] string IpAddress,
    [property: RedactData(Reason = RedactReason.PersonalInformation)] string UserAgent);
```

This allows input logging to remain enabled (useful for debugging) while ensuring PII is masked in log output.

---

## Messages

| File Name                                             | Description                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| [GeoRefDataUpdated.cs](Messages/GeoRefDataUpdated.cs) | Record representing a geographic reference data update event with a Version. |

---

## Interfaces

> ### CQRS
>
> #### Handlers
>
> ##### C (Commands)
>
> | File Name                                                                   | Description                                                                                            |
> | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
> | [ICommands.cs](Interfaces/CQRS/Handlers/C/ICommands.cs)                     | Partial interface defining command operations for geographic reference data state-changing operations. |
> | [ICommands.ReqUpdate.cs](Interfaces/CQRS/Handlers/C/ICommands.ReqUpdate.cs) | Extends ICommands with IReqUpdateHandler for requesting reference data updates via gRPC.               |
> | [ICommands.SetInDist.cs](Interfaces/CQRS/Handlers/C/ICommands.SetInDist.cs) | Extends ICommands with ISetInDistHandler for storing reference data in Redis distributed cache.        |
> | [ICommands.SetInMem.cs](Interfaces/CQRS/Handlers/C/ICommands.SetInMem.cs)   | Extends ICommands with ISetInMemHandler for storing reference data in memory cache.                    |
> | [ICommands.SetOnDisk.cs](Interfaces/CQRS/Handlers/C/ICommands.SetOnDisk.cs) | Extends ICommands with ISetOnDiskHandler for persisting reference data to disk.                        |
>
> ##### Q (Queries)
>
> | File Name                                                                     | Description                                                                                     |
> | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
> | [IQueries.cs](Interfaces/CQRS/Handlers/Q/IQueries.cs)                         | Partial interface defining query operations for geographic reference data read-only operations. |
> | [IQueries.GetFromDisk.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetFromDisk.cs) | Extends IQueries with IGetFromDiskHandler for retrieving reference data from disk storage.      |
> | [IQueries.GetFromDist.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetFromDist.cs) | Extends IQueries with IGetFromDistHandler for retrieving reference data from Redis.             |
> | [IQueries.GetFromMem.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetFromMem.cs)   | Extends IQueries with IGetFromMemHandler for retrieving reference data from memory cache.       |
>
> ##### X (Complex)
>
> | File Name                                                                 | Description                                                                                               |
> | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
> | [IComplex.cs](Interfaces/CQRS/Handlers/X/IComplex.cs)                     | Partial interface defining complex operations for geographic reference data operations with side effects. |
> | [IComplex.Get.cs](Interfaces/CQRS/Handlers/X/IComplex.Get.cs)             | Extends IComplex with IGetHandler for orchestrating multi-tier cache retrieval with fallback chain.       |
> | [IComplex.FindWhoIs.cs](Interfaces/CQRS/Handlers/X/IComplex.FindWhoIs.cs) | Extends IComplex with IFindWhoIsHandler for WhoIs lookup with local caching and gRPC fallback.            |

> ### Messaging
>
> #### Handlers
>
> ##### Sub (Subscribers)
>
> | File Name                                                              | Description                                                                                 |
> | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
> | [ISubs.cs](Interfaces/Messaging/Handlers/Sub/ISubs.cs)                 | Partial interface defining subscription operations for geographic reference data messaging. |
> | [ISubs.Updated.cs](Interfaces/Messaging/Handlers/Sub/ISubs.Updated.cs) | Extends ISubs with IUpdatedHandler for processing GeoRefDataUpdated messages.               |

---

## CQRS

> ### Handlers
>
> #### C (Commands)
>
> | File Name                                    | Description                                                                                                  |
> | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
> | [ReqUpdate.cs](CQRS/Handlers/C/ReqUpdate.cs) | Handler requesting reference data update from Geo service via gRPC, returning the response.                  |
> | [SetInDist.cs](CQRS/Handlers/C/SetInDist.cs) | Handler storing serialized GetReferenceDataResponse in Redis distributed cache with configurable expiration. |
> | [SetInMem.cs](CQRS/Handlers/C/SetInMem.cs)   | Handler storing GetReferenceDataResponse in memory cache with configurable expiration.                       |
> | [SetOnDisk.cs](CQRS/Handlers/C/SetOnDisk.cs) | Handler persisting serialized GetReferenceDataResponse to a local file for disk-tier fallback.               |
>
> #### Q (Queries)
>
> | File Name                                        | Description                                                                                         |
> | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
> | [GetFromDisk.cs](CQRS/Handlers/Q/GetFromDisk.cs) | Handler retrieving GetReferenceDataResponse from disk by deserializing the persisted protobuf file. |
> | [GetFromDist.cs](CQRS/Handlers/Q/GetFromDist.cs) | Handler retrieving GetReferenceDataResponse from Redis distributed cache.                           |
> | [GetFromMem.cs](CQRS/Handlers/Q/GetFromMem.cs)   | Handler retrieving GetReferenceDataResponse from memory cache.                                      |
>
> #### X (Complex)
>
> | File Name                                    | Description                                                                                                                     |
> | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
> | [Get.cs](CQRS/Handlers/X/Get.cs)             | Orchestrator handler implementing multi-tier cache fallback: Memory → Redis → Disk → gRPC, populating higher tiers on miss.     |
> | [FindWhoIs.cs](CQRS/Handlers/X/FindWhoIs.cs) | Handler for WhoIs lookups with local IMemoryCache caching and Geo gRPC service fallback. Used by request enrichment middleware. |

---

## Messaging

> ### Handlers
>
> #### Sub (Subscribers)
>
> | File Name                                       | Description                                                                                                      |
> | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
> | [Updated.cs](Messaging/Handlers/Sub/Updated.cs) | Handler processing GeoRefDataUpdated messages by requesting fresh data from Geo service and updating all caches. |
>
> ### MT (MassTransit)
>
> #### Consumers
>
> | File Name                                                       | Description                                                                                                |
> | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
> | [UpdatedConsumer.cs](Messaging/MT/Consumers/UpdatedConsumer.cs) | MassTransit IConsumer implementation that delegates GeoRefDataUpdated messages to the Updated sub handler. |
