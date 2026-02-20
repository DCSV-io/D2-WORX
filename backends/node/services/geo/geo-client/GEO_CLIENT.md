# @d2/geo-client

Service-owned client library for the Geo microservice. Full 1:1 mirror of .NET `Geo.Client` — contains interfaces, handler implementations, messages, and messaging consumer. Layer 4.

## Files

| File Name                                          | Description                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| [geo-client-options.ts](src/geo-client-options.ts)           | `GeoClientOptions` + `DEFAULT_GEO_CLIENT_OPTIONS` (WhoIs cache TTL, max entries, contact cache, `allowedContextKeys`, `apiKey`). |
| [index.ts](src/index.ts)                                     | Main barrel export for all interfaces, handlers, messages, options, and gRPC helpers. |
| [grpc/api-key-interceptor.ts](src/grpc/api-key-interceptor.ts) | gRPC client interceptor that adds `x-api-key` metadata to every outgoing call. |
| [grpc/create-geo-client.ts](src/grpc/create-geo-client.ts)   | Factory function `createGeoServiceClient(address, apiKey)` with API key interceptor pre-wired. |

---

## Interfaces

Handler contract interfaces organized in TLC hierarchy, mirroring .NET `Geo.Client/Interfaces/`.

> ### C (Commands)
>
> | File                                                        | Interface                 | Redaction                    | Description                                      |
> | ----------------------------------------------------------- | ------------------------- | ---------------------------- | ------------------------------------------------ |
> | [req-update.ts](src/interfaces/c/req-update.ts)             | `IReqUpdateHandler`       | _(none)_                     | Request reference data update via gRPC.          |
> | [set-in-mem.ts](src/interfaces/c/set-in-mem.ts)             | `ISetInMemHandler`        | `SET_IN_MEM_REDACTION`       | Store reference data in memory cache.            |
> | [set-in-dist.ts](src/interfaces/c/set-in-dist.ts)           | `ISetInDistHandler`       | `SET_IN_DIST_REDACTION`      | Store reference data in Redis distributed cache. |
> | [set-on-disk.ts](src/interfaces/c/set-on-disk.ts)           | `ISetOnDiskHandler`       | `SET_ON_DISK_REDACTION`      | Persist reference data to disk.                  |
> | [create-contacts.ts](src/interfaces/c/create-contacts.ts)   | `ICreateContactsHandler`  | `CREATE_CONTACTS_REDACTION`  | Create Geo contacts via gRPC. Validates `allowedContextKeys`. |
> | [delete-contacts-by-ext-keys.ts](src/interfaces/c/delete-contacts-by-ext-keys.ts) | `IDeleteContactsByExtKeysHandler` | _(none)_ | Delete Geo contacts by ext keys via gRPC + cache eviction. |

> ### Q (Queries)
>
> | File                                                                    | Interface                  | Redaction                      | Description                                                   |
> | ----------------------------------------------------------------------- | -------------------------- | ------------------------------ | ------------------------------------------------------------- |
> | [get-from-mem.ts](src/interfaces/q/get-from-mem.ts)                     | `IGetFromMemHandler`       | `GET_FROM_MEM_REDACTION`       | Retrieve reference data from memory cache.                    |
> | [get-from-dist.ts](src/interfaces/q/get-from-dist.ts)                   | `IGetFromDistHandler`      | `GET_FROM_DIST_REDACTION`      | Retrieve reference data from Redis.                           |
> | [get-from-disk.ts](src/interfaces/q/get-from-disk.ts)                   | `IGetFromDiskHandler`      | `GET_FROM_DISK_REDACTION`      | Retrieve reference data from disk storage.                    |
> | [get-contacts-by-ext-keys.ts](src/interfaces/q/get-contacts-by-ext-keys.ts) | `IGetContactsByExtKeysHandler` | `GET_CONTACTS_BY_EXT_KEYS_REDACTION` | Fetch contacts by ext keys with local cache-aside (immutable, no TTL). |

> ### X (Complex)
>
> | File                                            | Interface           | Redaction              | Description                                                |
> | ----------------------------------------------- | ------------------- | ---------------------- | ---------------------------------------------------------- |
> | [find-whois.ts](src/interfaces/x/find-whois.ts)                               | `IFindWhoIsHandler`              | `FIND_WHOIS_REDACTION`                    | WhoIs lookup with local caching and gRPC fallback.                          |
> | [get.ts](src/interfaces/x/get.ts)                                             | `IGetHandler`                    | `GET_REDACTION`                           | Multi-tier cache retrieval (Memory → Redis → Disk → gRPC).                 |
> | [update-contacts-by-ext-keys.ts](src/interfaces/x/update-contacts-by-ext-keys.ts) | `IUpdateContactsByExtKeysHandler` | `UPDATE_CONTACTS_BY_EXT_KEYS_REDACTION` | Replace contacts at ext keys via gRPC (atomic delete + create). |

> ### Sub (Subscribers)
>
> | File                                        | Interface         | Description                           |
> | ------------------------------------------- | ----------------- | ------------------------------------- |
> | [updated.ts](src/interfaces/sub/updated.ts) | `IUpdatedHandler` | Process `GeoRefDataUpdatedEvent` events. |

---

## Handlers

Handler implementations organized in TLC hierarchy. All extend `BaseHandler` and implement their corresponding interface.

> ### C (Commands)
>
> | File                                                        | Class            | Description                                                              |
> | ----------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
> | [req-update.ts](src/handlers/c/req-update.ts)               | `ReqUpdate`      | Calls Geo gRPC service to request reference data update.                 |
> | [set-in-mem.ts](src/handlers/c/set-in-mem.ts)               | `SetInMem`       | Stores `GetReferenceDataResponse` in memory cache with configurable TTL. |
> | [set-in-dist.ts](src/handlers/c/set-in-dist.ts)             | `SetInDist`      | Serializes and stores reference data in Redis + `GeoRefDataSerializer`.  |
> | [set-on-disk.ts](src/handlers/c/set-on-disk.ts)             | `SetOnDisk`      | Persists serialized reference data to local file.                        |
> | [create-contacts.ts](src/handlers/c/create-contacts.ts)                       | `CreateContacts`          | Creates Geo contacts via gRPC. Validates `allowedContextKeys`. PII redacted. |
> | [delete-contacts-by-ext-keys.ts](src/handlers/c/delete-contacts-by-ext-keys.ts) | `DeleteContactsByExtKeys` | Deletes Geo contacts by ext keys via gRPC + evicts from local cache. |

> ### Q (Queries)
>
> | File                                                                  | Class              | Description                                                            |
> | --------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
> | [get-from-mem.ts](src/handlers/q/get-from-mem.ts)                     | `GetFromMem`       | Retrieves reference data from memory cache.                            |
> | [get-from-dist.ts](src/handlers/q/get-from-dist.ts)                   | `GetFromDist`      | Retrieves and deserializes reference data from Redis.                  |
> | [get-from-disk.ts](src/handlers/q/get-from-disk.ts)                   | `GetFromDisk`      | Reads and deserializes reference data from disk file.                  |
> | [get-contacts-by-ext-keys.ts](src/handlers/q/get-contacts-by-ext-keys.ts) | `GetContactsByExtKeys` | Cache-aside contact retrieval by ext keys: local cache → gRPC for misses. Fail-open. |

> ### X (Complex)
>
> | File                                          | Class       | Description                                                                  |
> | --------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
> | [find-whois.ts](src/handlers/x/find-whois.ts)                                       | `FindWhoIs`              | WhoIs lookup with `MemoryCacheStore` (LRU) and Geo gRPC fallback.              |
> | [get.ts](src/handlers/x/get.ts)                                                     | `Get`                    | Orchestrator: Memory → Redis → Disk → gRPC, populating higher tiers on miss.   |
> | [update-contacts-by-ext-keys.ts](src/handlers/x/update-contacts-by-ext-keys.ts)     | `UpdateContactsByExtKeys`| Replaces contacts at ext keys via gRPC. Evicts ext-key cache. PII redacted.    |

---

## Messaging

> ### Handlers
>
> | File                                                | Class     | Description                                                                   |
> | --------------------------------------------------- | --------- | ----------------------------------------------------------------------------- |
> | [updated.ts](src/messaging/handlers/sub/updated.ts) | `Updated` | Processes `GeoRefDataUpdatedEvent` events — requests fresh data, updates caches. |

> ### Consumers
>
> | File                                                               | Export                    | Description                                         |
> | ------------------------------------------------------------------ | ------------------------- | --------------------------------------------------- |
> | [updated-consumer.ts](src/messaging/consumers/updated-consumer.ts) | `createUpdatedConsumer()` | Factory creating a `@d2/messaging` consumer bridge. |

---

## Data Redaction

Handlers dealing with proto-generated `GetReferenceDataResponse` suppress I/O logging via `RedactionSpec`. The `FindWhoIs` handler uses field-level masking for IP/fingerprint inputs.

| Handler          | suppressInput | suppressOutput | inputFields                    |
| ---------------- | ------------- | -------------- | ------------------------------ |
| SetInMem         | `true`        | —              | —                              |
| SetInDist        | `true`        | —              | —                              |
| SetOnDisk        | `true`        | —              | —                              |
| GetFromMem       | —             | `true`         | —                              |
| GetFromDist      | —             | `true`         | —                              |
| GetFromDisk      | —             | `true`         | —                              |
| Get              | —             | `true`         | —                              |
| FindWhoIs        | —             | `true`         | `["ipAddress", "fingerprint"]` |
| ReqUpdate        | _(none)_      | _(none)_       | —                              |
| CreateContacts          | `true`        | `true`         | —                              |
| DeleteContactsByExtKeys | _(none)_      | _(none)_       | —                              |
| GetContactsByExtKeys    | —             | `true`         | —                              |
| UpdateContactsByExtKeys | `true`        | `true`         | —                              |

## Security — API Key + Context Key Validation

Contacts are only accessible externally via ext keys (`contextKey` + `relatedEntityId`). ID-based get/delete are removed from client libraries (proto RPCs remain for Geo's internal use).

### Defense-in-Depth Layers

| Layer              | Mechanism                                             | Enforced By                                 |
| ------------------ | ----------------------------------------------------- | ------------------------------------------- |
| **Transport**      | gRPC metadata `x-api-key` header                      | Client interceptor + Geo.API server interceptor |
| **Ownership**      | API key → allowed context keys mapping                 | Geo.API `ApiKeyInterceptor` (server-side)   |
| **Client validation** | `allowedContextKeys` in `GeoClientOptions`         | All contact handlers (defense-in-depth)     |
| **Access pattern** | Ext-key-only (no PK-based get/delete externally)       | Client library (ID handlers removed)        |

### Cache Key Conventions

| Cache Key Pattern                                  | Value           | Populated By          | Evicted By                         |
| -------------------------------------------------- | --------------- | --------------------- | ---------------------------------- |
| `contact-ext:{contextKey}:{relatedEntityId}`       | `ContactDTO[]`  | GetContactsByExtKeys  | DeleteContactsByExtKeys, UpdateContactsByExtKeys |

Single `MemoryCacheStore` instance with LRU eviction (`contactCacheMaxEntries`). No TTL — contacts are immutable.

---

## Validation Schemas

Reusable Zod schemas for contact input validation, exported as single source of truth. Limits match Geo's EF Core entity configs (`ContactConfig.cs`, `LocationConfig.cs`) and FluentValidation rules (`ContactToCreateValidator`). Any service creating or updating contacts via Geo should import these instead of defining local schemas.

| File                                                               | Exports                                                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [contact-schemas.ts](src/validation/contact-schemas.ts)            | `contactMethodsSchema`, `personalDetailsSchema`, `professionalDetailsSchema`, `locationInputSchema`, `contactInputSchema` |

Compose into handler schemas: `z.object({ contact: contactInputSchema, label: z.string().max(100) })`.

---

## .NET Equivalent

`Geo.Client` — same interface + handler structure, `DefaultOptions` overrides for logging suppression, `[RedactData]` annotations on `FindWhoIsInput`. `ContactToCreateValidator` (FluentValidation) exported from `Geo.Client/Validators/` for the same reuse pattern (`.SetValidator()` composition).
