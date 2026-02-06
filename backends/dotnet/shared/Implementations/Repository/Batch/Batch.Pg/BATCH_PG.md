# Batch.Pg

Batched database query utilities for EF Core, chunking large ID lookups to avoid PostgreSQL parameter limits and IN clause performance issues. Integrates with D2Result for consistent OK/SOME_FOUND/NOT_FOUND status handling.

## Problem

PostgreSQL has limits on IN clause parameters (~32K) and performance degrades with large parameter lists. Naive queries like `WHERE id IN (id1, id2, ..., id10000)` can fail or perform poorly.

## Solution

`BatchQuery<TEntity, TKey>` chunks ID lookups into configurable batch sizes (default 500), executes them sequentially, and aggregates results. Provides fluent API via DbSet extension methods.

## Usage

```csharp
// Basic usage
var locations = await db.Locations
    .BatchGetByIds(hashIds, l => l.HashId)
    .ToListAsync(ct);

// With D2Result integration
var result = await db.Locations
    .BatchGetByIds(hashIds, l => l.HashId)
    .ToD2ResultAsync(traceId, ct);
// Returns Ok (all found), SomeFound (partial), or NotFound (none)

// Custom configuration
var locations = await db.Locations
    .BatchGetByIds(hashIds, l => l.HashId, opts =>
    {
        opts.BatchSize = 1000;
        opts.AsNoTracking = false;  // Enable change tracking
    })
    .ToListAsync(ct);
```

## Files

| File Name                                      | Description                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [BatchQuery.cs](BatchQuery.cs)                 | Core batched query class with ToListAsync, ToDictionaryAsync, ToAsyncEnumerable, GetMissingIdsAsync. |
| [BatchOptions.cs](BatchOptions.cs)             | Configuration options: BatchSize, AsNoTracking, DeduplicateIds, FilterNullIds.                       |
| [Extensions.cs](Extensions.cs)                 | DbSet extension method `BatchGetByIds` for fluent batch query creation.                              |
| [D2ResultExtensions.cs](D2ResultExtensions.cs) | BatchQuery extensions for ToD2ResultAsync and ToDictionaryD2ResultAsync with status code handling.   |

## BatchOptions Defaults

| Option         | Default | Description                                     |
| -------------- | ------- | ----------------------------------------------- |
| BatchSize      | 500     | Maximum IDs per database query (safe: 100-2000) |
| AsNoTracking   | true    | Disable EF change tracking for read performance |
| DeduplicateIds | true    | Remove duplicate IDs before querying            |
| FilterNullIds  | true    | Remove null/default IDs from input              |

## D2Result Status Codes

| Condition                  | Status Code | Data         |
| -------------------------- | ----------- | ------------ |
| All IDs found              | OK          | Full list    |
| Some IDs found             | SOME_FOUND  | Partial list |
| No IDs found               | NOT_FOUND   | null         |
| Empty input (not an error) | OK          | Empty list   |
