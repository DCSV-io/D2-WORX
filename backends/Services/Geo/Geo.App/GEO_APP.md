# Geo.App

Application layer for the Geo microservice defining handler interfaces and implementing publisher-side geographic reference data orchestration with multi-tier caching and update notifications.

## Files

| File Name                              | Description                                                                                                  |
|----------------------------------------|--------------------------------------------------------------------------------------------------------------|
| [Extensions.cs](Extensions.cs)         | DI extension method AddGeoApp registering publisher-side CQRS handlers including SetInDist for Redis writes. |
| [GeoAppOptions.cs](GeoAppOptions.cs)   | Options for application configuration including cache expiration times for Location, WhoIs, and Contact.     |

---

## Implementations

> ### CQRS
>
> #### Handlers
>
> ##### C (Commands)
>
> No command handlers - commands are implemented in shared GeoRefData.Default library.
>
> ##### Q (Queries)
>
> | File Name                                                                  | Description                                                                                              |
> |----------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
> | [GetLocationsByIds.cs](Implementations/CQRS/Handlers/Q/GetLocationsByIds.cs) | Query handler with memory cache → repository fallback, returning LocationDTOs with SOME_FOUND handling. |
>
> ##### U (Utilities)
>
> No utility handlers.
>
> ##### X (Complex)
>
> | File Name                                              | Description                                                                                                                                          |
> |--------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
> | [Get.cs](Implementations/CQRS/Handlers/X/Get.cs)       | Publisher-side orchestrator implementing memory → Redis → DB → disk fallback with cache population and update notification on authoritative fetch.   |

---

## Interfaces

> ### CQRS
>
> #### Handlers
>
> ##### Q (Queries)
>
> | File Name                                                                                 | Description                                                                   |
> |-------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
> | [IQueries.cs](Interfaces/CQRS/Handlers/Q/IQueries.cs)                                     | Partial interface defining query operations for CQRS handlers.                |
> | [IQueries.GetLocationsByIds.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetLocationsByIds.cs) | Extends IQueries with IGetLocationsByIdsHandler for batch Location retrieval. |
>
> ### Messaging
>
> #### Handlers
>
> ##### Pub (Publishers)
>
> | File Name                                                              | Description                                                                                   |
> |------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
> | [IPubs.cs](Interfaces/Messaging/Handlers/Pub/IPubs.cs)                 | Partial interface defining publisher operations for geographic data messaging.                |
> | [IPubs.Update.cs](Interfaces/Messaging/Handlers/Pub/IPubs.Update.cs)   | Extends IPubs with IUpdateHandler for publishing GeoRefDataUpdated messages.                  |
>
> ##### Sub (Subscribers)
>
> No subscriber interfaces - the Geo service publishes updates, it does not subscribe to them.
>
> ### Repository
>
> #### Handlers
>
> ##### C (Create)
>
> | File Name                                                                                 | Description                                                                    |
> |-------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
> | [ICreate.cs](Interfaces/Repository/Handlers/C/ICreate.cs)                                 | Partial interface defining create operations for geographic repository access. |
> | [ICreate.CreateLocations.cs](Interfaces/Repository/Handlers/C/ICreate.CreateLocations.cs) | Extends ICreate with ICreateLocationsHandler for batch Location creation.      |
>
> ##### R (Read)
>
> | File Name                                                                                       | Description                                                                                       |
> |-------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
> | [IRead.cs](Interfaces/Repository/Handlers/R/IRead.cs)                                           | Partial interface defining read operations for geographic repository access.                      |
> | [IRead.GetReferenceData.cs](Interfaces/Repository/Handlers/R/IRead.GetReferenceData.cs)         | Extends IRead with IGetReferenceDataHandler for fetching reference data from database.            |
> | [IRead.GetLocationsByIds.cs](Interfaces/Repository/Handlers/R/IRead.GetLocationsByIds.cs)       | Extends IRead with IGetLocationsByIdsHandler for batch Location retrieval by HashIds.             |
> | [IRead.GetWhoIsByIds.cs](Interfaces/Repository/Handlers/R/IRead.GetWhoIsByIds.cs)               | Extends IRead with IGetWhoIsByIdsHandler for batch WhoIs retrieval by HashIds.                    |
> | [IRead.GetContactsByIds.cs](Interfaces/Repository/Handlers/R/IRead.GetContactsByIds.cs)         | Extends IRead with IGetContactsByIdsHandler for batch Contact retrieval by HashIds.               |
> | [IRead.GetContactsByExtKeys.cs](Interfaces/Repository/Handlers/R/IRead.GetContactsByExtKeys.cs) | Extends IRead with IGetContactsByExtKeysHandler for Contact lookup by ContextKey/RelatedEntityId. |

---

## Mappers

Extension member mappers for converting between domain entities and protobuf DTOs.

| File Name                                      | Description                                                                                              |
|------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| [LocationMapper.cs](Mappers/LocationMapper.cs) | Extension members for Location ↔ LocationDTO conversions with Coordinates/StreetAddress.                 |
| [WhoIsMapper.cs](Mappers/WhoIsMapper.cs)       | Extension members for WhoIs ↔ WhoIsDTO conversions with LocationHashId FK handling.                      |
| [ContactMapper.cs](Mappers/ContactMapper.cs)   | Extension members for Contact ↔ ContactDTO conversions with nested Personal/Professional/ContactMethods. |
