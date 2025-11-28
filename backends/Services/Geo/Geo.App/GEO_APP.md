# Geo.App

Application layer for the Geo microservice defining handler interfaces and implementing publisher-side geographic reference data orchestration with multi-tier caching and update notifications.

## Files

| File Name                      | Description                                                                                                  |
|--------------------------------|--------------------------------------------------------------------------------------------------------------|
| [Extensions.cs](Extensions.cs) | DI extension method AddGeoApp registering publisher-side CQRS handlers including SetInDist for Redis writes. |

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
> No query handlers - queries are implemented in shared GeoRefData.Default library.
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
> ##### R (Read)
>
> | File Name                                                                               | Description                                                                            |
> |-----------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
> | [IRead.cs](Interfaces/Repository/Handlers/R/IRead.cs)                                   | Partial interface defining read operations for geographic repository access.           |
> | [IRead.GetReferenceData.cs](Interfaces/Repository/Handlers/R/IRead.GetReferenceData.cs) | Extends IRead with IGetReferenceDataHandler for fetching reference data from database. |
