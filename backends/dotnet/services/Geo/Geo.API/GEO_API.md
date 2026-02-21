# Geo.API

gRPC service layer exposing geographic reference data endpoints. Thin pass-through to the application layer handlers with D2ResultProto response wrapping.

## Files

| File Name                                                             | Description                                                                                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Program.cs](Program.cs)                                              | Service bootstrap with DI registration for Infra, GeoRefData provider, and App layers.         |
| [GeoService.cs](Services/GeoService.cs)                               | gRPC service implementation delegating to `IComplex.IGetHandler` with proto result conversion. |
| [ApiKeyInterceptor.cs](Interceptors/ApiKeyInterceptor.cs)             | gRPC server interceptor validating `x-api-key` header and context key authorization.           |
| [RequiresApiKeyAttribute.cs](Interceptors/RequiresApiKeyAttribute.cs) | Attribute marking gRPC methods that require API key validation.                                |

## gRPC Endpoints

Defined in [geo.proto](../../../../../contracts/protos/geo/v1/geo.proto):

| RPC                          | Request                             | Response                             | Description                                                                                                              |
| ---------------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `GetReferenceData`           | `GetReferenceDataRequest`           | `GetReferenceDataResponse`           | Returns full geographic reference data (countries, subdivisions, currencies, languages, locales, geopolitical entities). |
| `RequestReferenceDataUpdate` | `RequestReferenceDataUpdateRequest` | `RequestReferenceDataUpdateResponse` | Returns current version of reference data.                                                                               |
| `FindWhoIs`                  | `FindWhoIsRequest`                  | `FindWhoIsResponse`                  | Lookup WhoIs by IP+fingerprint with cache check, external API fallback, and Location enrichment.                         |
| `GetContacts`                | `GetContactsRequest`                | `GetContactsResponse`                | Internal only — batch Contact retrieval by IDs. Not exposed via client libraries.                                        |
| `DeleteContacts`             | `DeleteContactsRequest`             | `DeleteContactsResponse`             | Internal only — batch Contact deletion by IDs. Not exposed via client libraries.                                         |
| `GetContactsByExtKeys`       | `GetContactsByExtKeysRequest`       | `GetContactsByExtKeysResponse`       | Contact lookup by ContextKey/RelatedEntityId pairs with nested Location data.                                            |
| `CreateContacts`             | `CreateContactsRequest`             | `CreateContactsResponse`             | Batch Contact creation with embedded locations, returning ContactDTOs.                                                   |
| `DeleteContactsByExtKeys`    | `DeleteContactsByExtKeysRequest`    | `DeleteContactsByExtKeysResponse`    | Delete Contacts by ContextKey/RelatedEntityId pairs.                                                                     |
| `UpdateContactsByExtKeys`    | `UpdateContactsByExtKeysRequest`    | `UpdateContactsByExtKeysResponse`    | Replace Contacts at given ext keys (Geo internally deletes old, creates new).                                            |

## Security — API Key Interceptor

Contact-related RPCs require API key authentication via `x-api-key` gRPC metadata header. The `ApiKeyInterceptor` validates:

1. **API key existence** — looks up key in `GeoAppOptions.ApiKeyMappings`
2. **Context key authorization** — for RPCs with `[RequiresApiKey(ValidateContextKeys = true)]`, extracts context keys from the request and validates they're in the allowed list for that API key

| Scenario                  | Response                |
| ------------------------- | ----------------------- |
| Missing/invalid API key   | `Unauthenticated`       |
| Unauthorized context keys | `PermissionDenied`      |
| No attribute on method    | Pass-through (no check) |

Configuration via `GeoAppOptions.ApiKeyMappings`:

```json
{
  "GeoAppOptions": {
    "ApiKeyMappings": {
      "auth-service-key": ["org_contact", "user"],
      "billing-key": ["billing_contact"]
    }
  }
}
```

## DI Registration

Services are registered in layers:

```csharp
builder.Services.AddGeoInfra(dbConn, redisConn, mqConn);  // Infrastructure (DB, cache, messaging)
builder.Services.AddGeoRefDataProvider();                  // Provider-side cache handlers
builder.Services.AddGeoApp();                              // Application layer (CQRS handlers)
```

## Connection Strings

Required connection strings (injected via Aspire):

| Key               | Description             |
| ----------------- | ----------------------- |
| `d2-services-geo` | PostgreSQL database     |
| `d2-redis`        | Redis distributed cache |
| `d2-rabbitmq`     | RabbitMQ message broker |

## Architecture

```
GeoService (gRPC)
    │
    └──► IComplex.IGetHandler (App layer)
            │
            ├──► Memory cache (IQueries.IGetFromMemHandler)
            ├──► Redis cache (IQueries.IGetFromDistHandler)
            ├──► Disk cache (IQueries.IGetFromDiskHandler)
            └──► Repository (IRead.IGetReferenceDataHandler)
```

The gRPC layer is intentionally thin - it delegates to handlers and converts results to proto format. All error handling, retries, and cache population logic lives in the application layer.
