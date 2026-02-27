# @d2/batch-pg

Batched database query utilities for Drizzle/node-postgres, chunking large ID lookups to avoid PostgreSQL parameter limits and IN-clause performance issues. Integrates with D2Result for consistent OK/SOME_FOUND/NOT_FOUND status handling.

Mirrors .NET `Batch.Pg` — same chunking/dedup semantics, adapted to Drizzle's function-based API (no IQueryable/LINQ).

## Files

| File Name                                  | Description                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| [batch-query.ts](src/batch-query.ts)       | `batchQuery()` — chunked IN-clause queries with ID deduplication and null filtering. |
| [batch-result.ts](src/batch-result.ts)     | `toBatchResult()`, `toBatchDictionaryResult()` — D2Result partial-success mapping.   |
| [index.ts](src/index.ts)                   | Barrel export of all utilities.                                              |

---

## Batch Queries

Chunks large ID arrays into manageable batches, runs queries in parallel, and merges results.

```typescript
const results = await batchQuery(
  ids,
  (chunk) => db.select().from(users).where(inArray(users.id, chunk)),
  { batchSize: 500, deduplicateIds: true, filterNullIds: true },
);
```

| Option           | Default | Description                               |
| ---------------- | ------- | ----------------------------------------- |
| `batchSize`      | `500`   | Max IDs per IN-clause chunk               |
| `deduplicateIds` | `true`  | Remove duplicate IDs before chunking      |
| `filterNullIds`  | `true`  | Remove null/undefined IDs before chunking |

---

## Batch Result Mapping

Maps query results to D2Result with partial-success semantics.

| Result                   | D2Result                       |
| ------------------------ | ------------------------------ |
| 0 requested              | `Ok([])`                       |
| 0 found                  | `NotFound()`                   |
| Some found (< requested) | `SomeFound({ data: results })` |
| All found (= requested)  | `Ok({ data: results })`       |

```typescript
const result = toBatchResult(rows, requestedIds.length);
// result.success === true, result.statusCode === "SOME_FOUND"
```

Dictionary variant for key-value results:

```typescript
const result = toBatchDictionaryResult(resultMap, requestedKeys.length);
```

---

## .NET Equivalent

| Node.js (`@d2/batch-pg`)      | .NET (`Batch.Pg`)              | Notes                                         |
| ------------------------------ | ------------------------------ | --------------------------------------------- |
| `batchQuery(ids, queryFn, opts)` | `BatchGetByIds(ids, selector)` | Function vs fluent builder (no IQueryable in Drizzle) |
| `toBatchResult(results, count)` | `ToD2ResultAsync(traceId, ct)` | Same Ok/SomeFound/NotFound semantics          |
| `toBatchDictionaryResult()`    | `ToDictionaryD2ResultAsync()`  | Same Map/Dictionary semantics                 |
