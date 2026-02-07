# Interfaces

Interface definitions for handler-based operations across caching, repositories, and messaging using partial interface pattern for clean separation of concerns. Follows the TLC→2LC→3LC folder convention (see `BACKENDS.md`).

---

## Caching

> ### Distributed
>
> #### Handlers
>
> ##### C (Create)
>
> | File Name                                               | Description                                                       |
> | ------------------------------------------------------- | ----------------------------------------------------------------- |
> | [ICreate.cs](Caching/Distributed/Handlers/C/ICreate.cs) | Partial interface defining distributed cache creation operations. |
>
> ##### D (Delete)
>
> | File Name                                                             | Description                                                                               |
> | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
> | [IDelete.cs](Caching/Distributed/Handlers/D/IDelete.cs)               | Partial interface defining distributed cache deletion operations.                         |
> | [IDelete.Remove.cs](Caching/Distributed/Handlers/D/IDelete.Remove.cs) | Extends IDelete with IRemoveHandler for explicit distributed cache entry deletion by key. |
>
> ##### R (Read)
>
> | File Name                                                           | Description                                                                                       |
> | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
> | [IRead.cs](Caching/Distributed/Handlers/R/IRead.cs)                 | Partial interface defining distributed cache read operations.                                     |
> | [IRead.Exists.cs](Caching/Distributed/Handlers/R/IRead.Exists.cs)   | Extends IRead with IExistsHandler for checking distributed cache key existence without retrieval. |
> | [IRead.Get.cs](Caching/Distributed/Handlers/R/IRead.Get.cs)         | Extends IRead with IGetHandler for retrieving typed data from distributed cache by key.           |
> | [IRead.GetTtl.cs](Caching/Distributed/Handlers/R/IRead.GetTtl.cs)   | Extends IRead with IGetTtlHandler for retrieving the remaining time-to-live of a key.             |
>
> ##### U (Update)
>
> | File Name                                                                   | Description                                                                                     |
> | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
> | [IUpdate.cs](Caching/Distributed/Handlers/U/IUpdate.cs)                     | Partial interface defining distributed cache upsert operations.                                 |
> | [IUpdate.Set.cs](Caching/Distributed/Handlers/U/IUpdate.Set.cs)             | Extends IUpdate with ISetHandler for storing typed data in distributed cache with optional TTL. |
> | [IUpdate.Increment.cs](Caching/Distributed/Handlers/U/IUpdate.Increment.cs) | Extends IUpdate with IIncrementHandler for atomically incrementing a counter with optional TTL. |

> ### InMemory
>
> #### Handlers
>
> ##### C (Create)
>
> | File Name                                            | Description                                                     |
> | ---------------------------------------------------- | --------------------------------------------------------------- |
> | [ICreate.cs](Caching/InMemory/Handlers/C/ICreate.cs) | Partial interface defining in-memory cache creation operations. |
>
> ##### D (Delete)
>
> | File Name                                                          | Description                                                                             |
> | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
> | [IDelete.cs](Caching/InMemory/Handlers/D/IDelete.cs)               | Partial interface defining in-memory cache deletion operations.                         |
> | [IDelete.Remove.cs](Caching/InMemory/Handlers/D/IDelete.Remove.cs) | Extends IDelete with IRemoveHandler for explicit in-memory cache entry deletion by key. |
>
> ##### R (Read)
>
> | File Name                                                          | Description                                                                               |
> | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
> | [IRead.cs](Caching/InMemory/Handlers/R/IRead.cs)                   | Partial interface defining in-memory cache read operations.                               |
> | [IRead.Get.cs](Caching/InMemory/Handlers/R/IRead.Get.cs)           | Extends IRead with IGetHandler for retrieving typed data from in-memory cache by key.     |
> | [IRead.GetMany.cs](Caching/InMemory/Handlers/R/IRead.GetMany.cs)   | Extends IRead with IGetManyHandler for batch retrieval of typed data by multiple keys.    |
>
> ##### U (Update)
>
> | File Name                                                            | Description                                                                                     |
> | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
> | [IUpdate.cs](Caching/InMemory/Handlers/U/IUpdate.cs)                 | Partial interface defining in-memory cache upsert operations.                                   |
> | [IUpdate.Set.cs](Caching/InMemory/Handlers/U/IUpdate.Set.cs)         | Extends IUpdate with ISetHandler for storing typed data in memory cache with optional TTL.       |
> | [IUpdate.SetMany.cs](Caching/InMemory/Handlers/U/IUpdate.SetMany.cs) | Extends IUpdate with ISetManyHandler for batch storing typed data in memory cache with optional TTL. |

---

## Repository

> ### Transactions
>
> | File Name                                                                    | Description                                                                        |
> | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
> | [ITransaction.cs](Repository/Transactions/ITransaction.cs)                   | Partial interface defining transaction control operations for database operations. |
> | [ITransaction.Begin.cs](Repository/Transactions/ITransaction.Begin.cs)       | Extends ITransaction with IBeginHandler for starting database transactions.        |
> | [ITransaction.Commit.cs](Repository/Transactions/ITransaction.Commit.cs)     | Extends ITransaction with ICommitHandler for committing active transactions.       |
> | [ITransaction.Rollback.cs](Repository/Transactions/ITransaction.Rollback.cs) | Extends ITransaction with IRollbackHandler for rolling back active transactions.   |

---

## Note: Middleware Interfaces

Middleware handler interfaces (e.g., `IRateLimit.Check`) are co-located with their implementation projects rather than in this shared Interfaces project. This is because middleware contracts are tightly coupled to their implementation and not consumed independently by multiple services.

- **RateLimit**: `Implementations/Middleware/RateLimit.Default/Interfaces/`
- **RequestEnrichment**: `Implementations/Middleware/RequestEnrichment.Default/Interfaces/`

On the Node.js side, middleware contracts have been centralized in the `@d2/interfaces` package under `middleware/{ratelimit,request-enrichment}/` (see Step 7a restructuring).
