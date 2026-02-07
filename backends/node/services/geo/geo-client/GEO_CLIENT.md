# @d2/geo-client

Service-owned client library for the Geo microservice. Full 1:1 mirror of .NET `Geo.Client` — contains interfaces, handler implementations, messages, and messaging consumer. Layer 4.

## Files

| File Name                                                    | Description                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [geo-client-options.ts](src/geo-client-options.ts)           | `GeoClientOptions` + `DEFAULT_GEO_CLIENT_OPTIONS` (WhoIs cache TTL, max entries).  |
| [index.ts](src/index.ts)                                     | Main barrel export for all interfaces, handlers, messages, and options.             |

---

## Interfaces

Handler contract interfaces organized in TLC hierarchy, mirroring .NET `Geo.Client/Interfaces/`.

> ### C (Commands)
>
> | File                                               | Interface            | Redaction                  | Description                                                |
> | -------------------------------------------------- | -------------------- | -------------------------- | ---------------------------------------------------------- |
> | [req-update.ts](src/interfaces/c/req-update.ts)    | `IReqUpdateHandler`  | _(none)_                   | Request reference data update via gRPC.                    |
> | [set-in-mem.ts](src/interfaces/c/set-in-mem.ts)    | `ISetInMemHandler`   | `SET_IN_MEM_REDACTION`     | Store reference data in memory cache.                      |
> | [set-in-dist.ts](src/interfaces/c/set-in-dist.ts)  | `ISetInDistHandler`  | `SET_IN_DIST_REDACTION`    | Store reference data in Redis distributed cache.           |
> | [set-on-disk.ts](src/interfaces/c/set-on-disk.ts)  | `ISetOnDiskHandler`  | `SET_ON_DISK_REDACTION`    | Persist reference data to disk.                            |

> ### Q (Queries)
>
> | File                                                     | Interface              | Redaction                    | Description                                        |
> | -------------------------------------------------------- | ---------------------- | ---------------------------- | -------------------------------------------------- |
> | [get-from-mem.ts](src/interfaces/q/get-from-mem.ts)      | `IGetFromMemHandler`   | `GET_FROM_MEM_REDACTION`     | Retrieve reference data from memory cache.         |
> | [get-from-dist.ts](src/interfaces/q/get-from-dist.ts)    | `IGetFromDistHandler`  | `GET_FROM_DIST_REDACTION`    | Retrieve reference data from Redis.                |
> | [get-from-disk.ts](src/interfaces/q/get-from-disk.ts)    | `IGetFromDiskHandler`  | `GET_FROM_DISK_REDACTION`    | Retrieve reference data from disk storage.         |

> ### X (Complex)
>
> | File                                                 | Interface            | Redaction                | Description                                                     |
> | ---------------------------------------------------- | -------------------- | ------------------------ | --------------------------------------------------------------- |
> | [find-whois.ts](src/interfaces/x/find-whois.ts)      | `IFindWhoIsHandler`  | `FIND_WHOIS_REDACTION`   | WhoIs lookup with local caching and gRPC fallback.              |
> | [get.ts](src/interfaces/x/get.ts)                    | `IGetHandler`        | `GET_REDACTION`          | Multi-tier cache retrieval (Memory → Redis → Disk → gRPC).     |

> ### Sub (Subscribers)
>
> | File                                             | Interface          | Description                                          |
> | ------------------------------------------------ | ------------------ | ---------------------------------------------------- |
> | [updated.ts](src/interfaces/sub/updated.ts)      | `IUpdatedHandler`  | Process `GeoRefDataUpdated` messages.                |

---

## Handlers

Handler implementations organized in TLC hierarchy. All extend `BaseHandler` and implement their corresponding interface.

> ### C (Commands)
>
> | File                                               | Class        | Description                                                                  |
> | -------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
> | [req-update.ts](src/handlers/c/req-update.ts)      | `ReqUpdate`  | Calls Geo gRPC service to request reference data update.                     |
> | [set-in-mem.ts](src/handlers/c/set-in-mem.ts)      | `SetInMem`   | Stores `GetReferenceDataResponse` in memory cache with configurable TTL.     |
> | [set-in-dist.ts](src/handlers/c/set-in-dist.ts)    | `SetInDist`  | Serializes and stores reference data in Redis + `GeoRefDataSerializer`.      |
> | [set-on-disk.ts](src/handlers/c/set-on-disk.ts)    | `SetOnDisk`  | Persists serialized reference data to local file.                            |

> ### Q (Queries)
>
> | File                                                   | Class          | Description                                                          |
> | ------------------------------------------------------ | -------------- | -------------------------------------------------------------------- |
> | [get-from-mem.ts](src/handlers/q/get-from-mem.ts)      | `GetFromMem`   | Retrieves reference data from memory cache.                          |
> | [get-from-dist.ts](src/handlers/q/get-from-dist.ts)    | `GetFromDist`  | Retrieves and deserializes reference data from Redis.                |
> | [get-from-disk.ts](src/handlers/q/get-from-disk.ts)    | `GetFromDisk`  | Reads and deserializes reference data from disk file.                |

> ### X (Complex)
>
> | File                                             | Class       | Description                                                                       |
> | ------------------------------------------------ | ----------- | --------------------------------------------------------------------------------- |
> | [find-whois.ts](src/handlers/x/find-whois.ts)    | `FindWhoIs` | WhoIs lookup with `MemoryCacheStore` (LRU) and Geo gRPC fallback.                |
> | [get.ts](src/handlers/x/get.ts)                  | `Get`       | Orchestrator: Memory → Redis → Disk → gRPC, populating higher tiers on miss.     |

---

## Messages

| File                                                       | Description                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| [geo-ref-data-updated.ts](src/messages/geo-ref-data-updated.ts) | `GeoRefDataUpdated` message type (version number for cache invalidation). |

---

## Messaging

> ### Handlers
>
> | File                                                        | Class      | Description                                                                    |
> | ----------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
> | [updated.ts](src/messaging/handlers/sub/updated.ts)         | `Updated`  | Processes `GeoRefDataUpdated` messages — requests fresh data, updates caches.  |

> ### Consumers
>
> | File                                                              | Export                    | Description                                       |
> | ----------------------------------------------------------------- | ------------------------- | ------------------------------------------------- |
> | [updated-consumer.ts](src/messaging/consumers/updated-consumer.ts) | `createUpdatedConsumer()` | Factory creating a `@d2/messaging` consumer bridge. |

---

## Data Redaction

Handlers dealing with proto-generated `GetReferenceDataResponse` suppress I/O logging via `RedactionSpec`. The `FindWhoIs` handler uses field-level masking for IP/fingerprint inputs.

| Handler     | suppressInput | suppressOutput | inputFields                       |
| ----------- | ------------- | -------------- | --------------------------------- |
| SetInMem    | `true`        | —              | —                                 |
| SetInDist   | `true`        | —              | —                                 |
| SetOnDisk   | `true`        | —              | —                                 |
| GetFromMem  | —             | `true`         | —                                 |
| GetFromDist | —             | `true`         | —                                 |
| GetFromDisk | —             | `true`         | —                                 |
| Get         | —             | `true`         | —                                 |
| FindWhoIs   | —             | `true`         | `["ipAddress", "fingerprint"]`    |
| ReqUpdate   | _(none)_      | _(none)_       | —                                 |

## .NET Equivalent

`Geo.Client` — same interface + handler structure, `DefaultOptions` overrides for logging suppression, `[RedactData]` annotations on `FindWhoIsInput`.
