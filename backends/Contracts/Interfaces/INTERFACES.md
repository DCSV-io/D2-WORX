# Interfaces

Interface definitions for handler-based operations across caching, repositories, and messaging using partial interface pattern for clean separation of concerns.

---

## Caching

> ### Distributed
>
> #### Handlers
>
> ##### C (Create)
>
> | File Name                                               | Description                                                       |
> |---------------------------------------------------------|-------------------------------------------------------------------|
> | [ICreate.cs](Caching/Distributed/Handlers/C/ICreate.cs) | Partial interface defining distributed cache creation operations. |
>
> ##### D (Delete)
>
> | File Name                                                             | Description                                                                               |
> |-----------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
> | [IDelete.cs](Caching/Distributed/Handlers/D/IDelete.cs)               | Partial interface defining distributed cache deletion operations.                         |
> | [IDelete.Remove.cs](Caching/Distributed/Handlers/D/IDelete.Remove.cs) | Extends IDelete with IRemoveHandler for explicit distributed cache entry deletion by key. |
>
> ##### R (Read)
>
> | File Name                                                         | Description                                                                                       |
> |-------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
> | [IRead.cs](Caching/Distributed/Handlers/R/IRead.cs)               | Partial interface defining distributed cache read operations.                                     |
> | [IRead.Exists.cs](Caching/Distributed/Handlers/R/IRead.Exists.cs) | Extends IRead with IExistsHandler for checking distributed cache key existence without retrieval. |
> | [IRead.Get.cs](Caching/Distributed/Handlers/R/IRead.Get.cs)       | Extends IRead with IGetHandler for retrieving typed data from distributed cache by key.           |
>
> ##### U (Update)
>
> | File Name                                                       | Description                                                                                     |
> |-----------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
> | [IUpdate.cs](Caching/Distributed/Handlers/U/IUpdate.cs)         | Partial interface defining distributed cache upsert operations.                                 |
> | [IUpdate.Set.cs](Caching/Distributed/Handlers/U/IUpdate.Set.cs) | Extends IUpdate with ISetHandler for storing typed data in distributed cache with optional TTL. |

> ### InMemory
>
> #### Handlers
>
> ##### C (Create)
>
> | File Name                                            | Description                                                     |
> |------------------------------------------------------|-----------------------------------------------------------------|
> | [ICreate.cs](Caching/InMemory/Handlers/C/ICreate.cs) | Partial interface defining in-memory cache creation operations. |
>
> ##### D (Delete)
>
> | File Name                                                          | Description                                                                             |
> |--------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
> | [IDelete.cs](Caching/InMemory/Handlers/D/IDelete.cs)               | Partial interface defining in-memory cache deletion operations.                         |
> | [IDelete.Remove.cs](Caching/InMemory/Handlers/D/IDelete.Remove.cs) | Extends IDelete with IRemoveHandler for explicit in-memory cache entry deletion by key. |
>
> ##### R (Read)
>
> | File Name                                                  | Description                                                                            |
> |------------------------------------------------------------|----------------------------------------------------------------------------------------|
> | [IRead.cs](Caching/InMemory/Handlers/R/IRead.cs)           | Partial interface defining in-memory cache read operations.                            |
> | [IRead.Get.cs](Caching/InMemory/Handlers/R/IRead.Get.cs)   | Extends IRead with IGetHandler for retrieving typed data from in-memory cache by key.  |
>
> ##### U (Update)
>
> | File Name                                                    | Description                                                                                   |
> |--------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
> | [IUpdate.cs](Caching/InMemory/Handlers/U/IUpdate.cs)         | Partial interface defining in-memory cache upsert operations.                                 |
> | [IUpdate.Set.cs](Caching/InMemory/Handlers/U/IUpdate.Set.cs) | Extends IUpdate with ISetHandler for storing typed data in memory cache with optional TTL.    |

---

## Common

> ### GeoRefData
>
> #### CQRS
>
> ##### Handlers
>
> ###### C (Commands)
>
> | File Name                                                                          | Description                                                                                            |
> |------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
> | [ICommands.cs](Common/GeoRefData/CQRS/Handlers/C/ICommands.cs)                     | Partial interface defining command operations for geographic reference data state-changing operations. |
> | [ICommands.ReqUpdate.cs](Common/GeoRefData/CQRS/Handlers/C/ICommands.ReqUpdate.cs) | Extends ICommands with IReqUpdateHandler for requesting reference data updates via gRPC.               |
> | [ICommands.SetInDist.cs](Common/GeoRefData/CQRS/Handlers/C/ICommands.SetInDist.cs) | Extends ICommands with ISetInDistHandler for storing reference data in Redis distributed cache.        |
> | [ICommands.SetInMem.cs](Common/GeoRefData/CQRS/Handlers/C/ICommands.SetInMem.cs)   | Extends ICommands with ISetInMemHandler for storing reference data in memory cache.                    |
> | [ICommands.SetOnDisk.cs](Common/GeoRefData/CQRS/Handlers/C/ICommands.SetOnDisk.cs) | Extends ICommands with ISetOnDiskHandler for persisting reference data to disk.                        |
>
> ###### Q (Queries)
>
> | File Name                                                                            | Description                                                                                     |
> |--------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
> | [IQueries.cs](Common/GeoRefData/CQRS/Handlers/Q/IQueries.cs)                         | Partial interface defining query operations for geographic reference data read-only operations. |
> | [IQueries.GetFromDisk.cs](Common/GeoRefData/CQRS/Handlers/Q/IQueries.GetFromDisk.cs) | Extends IQueries with IGetFromDiskHandler for retrieving reference data from disk storage.      |
> | [IQueries.GetFromDist.cs](Common/GeoRefData/CQRS/Handlers/Q/IQueries.GetFromDist.cs) | Extends IQueries with IGetFromDistHandler for retrieving reference data from Redis.             |
> | [IQueries.GetFromMem.cs](Common/GeoRefData/CQRS/Handlers/Q/IQueries.GetFromMem.cs)   | Extends IQueries with IGetFromMemHandler for retrieving reference data from memory cache.       |
>
> ###### X (Complex)
>
> | File Name                                                            | Description                                                                                               |
> |----------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
> | [IComplex.cs](Common/GeoRefData/CQRS/Handlers/X/IComplex.cs)         | Partial interface defining complex operations for geographic reference data operations with side effects. |
> | [IComplex.Get.cs](Common/GeoRefData/CQRS/Handlers/X/IComplex.Get.cs) | Extends IComplex with IGetHandler for orchestrating multi-tier cache retrieval with fallback chain.       |
>
> #### Messaging
>
> ##### Handlers
>
> ###### Sub (Subscribers)
>
> | File Name                                                                     | Description                                                                                 |
> |-------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
> | [ISubs.cs](Common/GeoRefData/Messaging/Handlers/Sub/ISubs.cs)                 | Partial interface defining subscription operations for geographic reference data messaging. |
> | [ISubs.Updated.cs](Common/GeoRefData/Messaging/Handlers/Sub/ISubs.Updated.cs) | Extends ISubs with IUpdatedHandler for processing GeoRefDataUpdated messages.               |

---

## Repository

> ### Transactions
>
> | File Name                                                                    | Description                                                                        |
> |------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
> | [ITransaction.cs](Repository/Transactions/ITransaction.cs)                   | Partial interface defining transaction control operations for database operations. |
> | [ITransaction.Begin.cs](Repository/Transactions/ITransaction.Begin.cs)       | Extends ITransaction with IBeginHandler for starting database transactions.        |
> | [ITransaction.Commit.cs](Repository/Transactions/ITransaction.Commit.cs)     | Extends ITransaction with ICommitHandler for committing active transactions.       |
> | [ITransaction.Rollback.cs](Repository/Transactions/ITransaction.Rollback.cs) | Extends ITransaction with IRollbackHandler for rolling back active transactions.   |
