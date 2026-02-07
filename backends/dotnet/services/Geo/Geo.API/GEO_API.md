# Geo.API

gRPC service layer exposing geographic reference data endpoints. Thin pass-through to the application layer handlers with D2ResultProto response wrapping.

## Files

| File Name                               | Description                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Program.cs](Program.cs)                | Service bootstrap with DI registration for Infra, GeoRefData provider, and App layers.         |
| [GeoService.cs](Services/GeoService.cs) | gRPC service implementation delegating to `IComplex.IGetHandler` with proto result conversion. |

## gRPC Endpoints

Defined in [geo.proto](../../../../../contracts/protos/geo/v1/geo.proto):

| RPC                          | Request                             | Response                             | Description                                                                                                              |
| ---------------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `GetReferenceData`           | `GetReferenceDataRequest`           | `GetReferenceDataResponse`           | Returns full geographic reference data (countries, subdivisions, currencies, languages, locales, geopolitical entities). |
| `RequestReferenceDataUpdate` | `RequestReferenceDataUpdateRequest` | `RequestReferenceDataUpdateResponse` | Returns current version of reference data.                                                                               |

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
