# Geo.App

Application layer for the Geo microservice defining handler interfaces and implementing publisher-side geographic reference data orchestration with multi-tier caching and update notifications.

## Files

| File Name                              | Description                                                                                                  |
|----------------------------------------|--------------------------------------------------------------------------------------------------------------|
| [Extensions.cs](Extensions.cs)         | DI extension method AddGeoApp registering CQRS handlers for Location, WhoIs, Contact operations.            |
| [GeoAppOptions.cs](GeoAppOptions.cs)   | Options for application configuration including cache expiration times for Location, WhoIs, and Contact.     |

---

## Implementations

> ### CQRS
>
> #### Handlers
>
> ##### C (Commands)
>
> | File Name                                                                    | Description                                                                                                    |
> |------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
> | [CreateLocations.cs](Implementations/CQRS/Handlers/C/CreateLocations.cs)     | Command handler creating Locations via repository with cache population on success.                                          |
> | [CreateWhoIs.cs](Implementations/CQRS/Handlers/C/CreateWhoIs.cs)             | Command handler creating WhoIs records via repository with cache population on success.                                      |
> | [CreateContacts.cs](Implementations/CQRS/Handlers/C/CreateContacts.cs)       | Command handler creating Contacts with embedded locations, returning ContactDTOs with nested Location data on success.       |
> | [DeleteContacts.cs](Implementations/CQRS/Handlers/C/DeleteContacts.cs)       | Command handler deleting Contacts via repository with cache invalidation for deleted IDs.                      |
>
> ##### Q (Queries)
>
> | File Name                                                                          | Description                                                                                                                      |
> |------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
> | [GetLocationsByIds.cs](Implementations/CQRS/Handlers/Q/GetLocationsByIds.cs)       | Query handler with memory cache → repository fallback, returning LocationDTOs with SOME_FOUND handling.                          |
> | [GetWhoIsByIds.cs](Implementations/CQRS/Handlers/Q/GetWhoIsByIds.cs)               | Query handler with memory cache → repository fallback, returning WhoIsDTOs with nested Location data and SOME_FOUND handling.    |
> | [GetContactsByIds.cs](Implementations/CQRS/Handlers/Q/GetContactsByIds.cs)         | Query handler with memory cache → repository fallback, returning ContactDTOs with nested Location data and SOME_FOUND handling.  |
> | [GetContactsByExtKeys.cs](Implementations/CQRS/Handlers/Q/GetContactsByExtKeys.cs) | Query handler for Contacts by ContextKey/RelatedEntityId with cache → repository fallback and nested Location data.              |
>
> ##### U (Utilities)
>
> No utility handlers.
>
> ##### X (Complex)
>
> | File Name                                                    | Description                                                                                                                                          |
> |--------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
> | [Get.cs](Implementations/CQRS/Handlers/X/Get.cs)             | Publisher-side orchestrator implementing memory → Redis → DB → disk fallback with cache population and update notification on authoritative fetch.            |
> | [FindWhoIs.cs](Implementations/CQRS/Handlers/X/FindWhoIs.cs) | Complex handler for WhoIs lookup by IP+fingerprint with cache check → external API → create flow, returning WhoIsDTOs with nested Location data when present. |

---

## Interfaces

> ### CQRS
>
> #### Handlers
>
> ##### C (Commands)
>
> | File Name                                                                                   | Description                                                                      |
> |---------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
> | [ICommands.cs](Interfaces/CQRS/Handlers/C/ICommands.cs)                                     | Partial interface defining command operations for CQRS handlers.                 |
> | [ICommands.CreateLocations.cs](Interfaces/CQRS/Handlers/C/ICommands.CreateLocations.cs)     | Extends ICommands with ICreateLocationsHandler for batch Location creation.      |
> | [ICommands.CreateWhoIs.cs](Interfaces/CQRS/Handlers/C/ICommands.CreateWhoIs.cs)             | Extends ICommands with ICreateWhoIsHandler for batch WhoIs creation.             |
> | [ICommands.CreateContacts.cs](Interfaces/CQRS/Handlers/C/ICommands.CreateContacts.cs)       | Extends ICommands with ICreateContactsHandler for batch Contact creation.        |
> | [ICommands.DeleteContacts.cs](Interfaces/CQRS/Handlers/C/ICommands.DeleteContacts.cs)       | Extends ICommands with IDeleteContactsHandler for batch Contact deletion.        |
>
> ##### Q (Queries)
>
> | File Name                                                                                       | Description                                                                            |
> |-------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
> | [IQueries.cs](Interfaces/CQRS/Handlers/Q/IQueries.cs)                                           | Partial interface defining query operations for CQRS handlers.                         |
> | [IQueries.GetLocationsByIds.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetLocationsByIds.cs)       | Extends IQueries with IGetLocationsByIdsHandler for batch Location retrieval.          |
> | [IQueries.GetWhoIsByIds.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetWhoIsByIds.cs)               | Extends IQueries with IGetWhoIsByIdsHandler for batch WhoIs retrieval.                 |
> | [IQueries.GetContactsByIds.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetContactsByIds.cs)         | Extends IQueries with IGetContactsByIdsHandler for batch Contact retrieval.            |
> | [IQueries.GetContactsByExtKeys.cs](Interfaces/CQRS/Handlers/Q/IQueries.GetContactsByExtKeys.cs) | Extends IQueries with IGetContactsByExtKeysHandler for Contact lookup by external key. |
>
> ##### X (Complex)
>
> | File Name                                                                                 | Description                                                                             |
> |-------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
> | [IComplex.cs](Interfaces/CQRS/Handlers/X/IComplex.cs)                                     | Partial interface defining complex operations for CQRS handlers.                        |
> | [IComplex.FindWhoIs.cs](Interfaces/CQRS/Handlers/X/IComplex.FindWhoIs.cs)                 | Extends IComplex with IFindWhoIsHandler for WhoIs lookup with external API integration. |
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
> | File Name                                                                                   | Description                                                                    |
> |---------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
> | [ICreate.cs](Interfaces/Repository/Handlers/C/ICreate.cs)                                   | Partial interface defining create operations for geographic repository access. |
> | [ICreate.CreateLocations.cs](Interfaces/Repository/Handlers/C/ICreate.CreateLocations.cs)   | Extends ICreate with ICreateLocationsHandler for batch Location creation.      |
> | [ICreate.CreateWhoIs.cs](Interfaces/Repository/Handlers/C/ICreate.CreateWhoIs.cs)           | Extends ICreate with ICreateWhoIsHandler for batch WhoIs creation.             |
> | [ICreate.CreateContacts.cs](Interfaces/Repository/Handlers/C/ICreate.CreateContacts.cs)     | Extends ICreate with ICreateContactsHandler for batch Contact creation.        |
>
> ##### D (Delete)
>
> | File Name                                                                                   | Description                                                                    |
> |---------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
> | [IDelete.cs](Interfaces/Repository/Handlers/D/IDelete.cs)                                   | Partial interface defining delete operations for geographic repository access. |
> | [IDelete.DeleteContacts.cs](Interfaces/Repository/Handlers/D/IDelete.DeleteContacts.cs)     | Extends IDelete with IDeleteContactsHandler for batch Contact deletion.        |
>
> ##### R (Read)
>
> | File Name                                                                                       | Description                                                                                       |
> |-------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
> | [IRead.cs](Interfaces/Repository/Handlers/R/IRead.cs)                                           | Partial interface defining read operations for geographic repository access.                      |
> | [IRead.GetReferenceData.cs](Interfaces/Repository/Handlers/R/IRead.GetReferenceData.cs)         | Extends IRead with IGetReferenceDataHandler for fetching reference data from database.            |
> | [IRead.GetLocationsByIds.cs](Interfaces/Repository/Handlers/R/IRead.GetLocationsByIds.cs)       | Extends IRead with IGetLocationsByIdsHandler for batch Location retrieval by HashIds.             |
> | [IRead.GetWhoIsByIds.cs](Interfaces/Repository/Handlers/R/IRead.GetWhoIsByIds.cs)               | Extends IRead with IGetWhoIsByIdsHandler for batch WhoIs retrieval by HashIds.                    |
> | [IRead.GetContactsByIds.cs](Interfaces/Repository/Handlers/R/IRead.GetContactsByIds.cs)         | Extends IRead with IGetContactsByIdsHandler for batch Contact retrieval by GUIDs.                 |
> | [IRead.GetContactsByExtKeys.cs](Interfaces/Repository/Handlers/R/IRead.GetContactsByExtKeys.cs) | Extends IRead with IGetContactsByExtKeysHandler for Contact lookup by ContextKey/RelatedEntityId. |
>
> ### WhoIs
>
> #### Client Interfaces
>
> | File Name                                                    | Description                                                                       |
> |--------------------------------------------------------------|-----------------------------------------------------------------------------------|
> | [IIpInfoClient.cs](Interfaces/WhoIs/IIpInfoClient.cs)        | Interface abstracting IP information lookups for testability.                     |
> | [IpInfoResponse.cs](Interfaces/WhoIs/IpInfoResponse.cs)      | Response record containing IP details (location, ASN, org) from external lookup.  |
> | [IpInfoPrivacy.cs](Interfaces/WhoIs/IpInfoPrivacy.cs)        | Privacy flags record (VPN, proxy, Tor, relay, hosting) from IP information APIs.  |
>
> #### Handlers
>
> ##### R (Read)
>
> | File Name                                                          | Description                                                                     |
> |--------------------------------------------------------------------|---------------------------------------------------------------------------------|
> | [IRead.cs](Interfaces/WhoIs/Handlers/R/IRead.cs)                   | Partial interface defining read operations for external WhoIs providers.        |
> | [IRead.Populate.cs](Interfaces/WhoIs/Handlers/R/IRead.Populate.cs) | Extends IRead with IPopulateHandler for fetching WhoIs data from external APIs. |

---

## Mappers

Extension member mappers for converting between domain entities and protobuf DTOs.

| File Name                                                | Description                                                                                              |
|----------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| [LocationMapper.cs](Mappers/LocationMapper.cs)           | Extension members for Location ↔ LocationDTO conversions with Coordinates/StreetAddress.                 |
| [WhoIsMapper.cs](Mappers/WhoIsMapper.cs)                 | Extension members for WhoIs ↔ WhoIsDTO conversions with LocationHashId FK handling.                      |
| [ContactMapper.cs](Mappers/ContactMapper.cs)             | Extension members for Contact ↔ ContactDTO conversions with nested Personal/Professional/ContactMethods. |
| [CoordinatesMapper.cs](Mappers/CoordinatesMapper.cs)     | Extension members for Coordinates ↔ CoordinatesDTO conversions.                                          |
| [StreetAddressMapper.cs](Mappers/StreetAddressMapper.cs) | Extension members for StreetAddress ↔ StreetAddressDTO conversions.                                      |
| [EmailAddressMapper.cs](Mappers/EmailAddressMapper.cs)   | Extension members for EmailAddress ↔ EmailAddressDTO conversions with label handling.                    |
| [PhoneNumberMapper.cs](Mappers/PhoneNumberMapper.cs)     | Extension members for PhoneNumber ↔ PhoneNumberDTO conversions with label handling.                      |
| [PersonalMapper.cs](Mappers/PersonalMapper.cs)           | Extension members for Personal ↔ PersonalDTO conversions with enum mappings.                             |
| [ProfessionalMapper.cs](Mappers/ProfessionalMapper.cs)   | Extension members for Professional ↔ ProfessionalDTO conversions with URI handling.                      |
| [ContactMethodsMapper.cs](Mappers/ContactMethodsMapper.cs) | Extension members for ContactMethods ↔ ContactMethodsDTO conversions with nested collections.          |
