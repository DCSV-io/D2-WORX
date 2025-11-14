# Protos.DotNet

C# code generation project that compiles Protocol Buffer definitions into strongly-typed gRPC clients, servers, and DTOs. Uses Grpc.Tools to automatically generate code from .proto files during build.

## Proto Definitions

Protocol Buffer source files define service contracts and message schemas for inter-service communication:

| File Name                                                  | Description                                                                                                                                                                                |
|------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [geo.proto](../../../_protos/geo/geo.v1/geo.proto)         | GeoService contract with GetReferenceData RPC returning versioned Country, Subdivision, Currency, Language, Locale, and GeopoliticalEntity DTOs with ISO standard codes and relationships. |
| [ping.proto](../../../_protos/common/common.v1/ping.proto) | Simple PingService for testing proto generation and gRPC connectivity with request/response messages.                                                                                      |

## Generated Output

Grpc.Tools produces C# code including:
- Service client stubs (e.g., `GeoService.GeoServiceClient`) for calling remote services
- Service base classes (e.g., `GeoService.GeoServiceBase`) for implementing service handlers
- Message DTOs with protobuf serialization (e.g., `CountryDTO`, `GetReferenceDataResponse`)
- Map/repeated field collections for complex data structures

**Note:** Generated code is produced automatically during build. Modify source .proto files to change contracts.
