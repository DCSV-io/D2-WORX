# @d2/batch-pg

Batched database utilities for Drizzle/node-postgres, chunking large ID lookups and deletes to avoid PostgreSQL parameter limits and IN-clause performance issues. Integrates with D2Result for consistent OK/SOME_FOUND/NOT_FOUND status handling.

Mirrors .NET `Batch.Pg` — same chunking/dedup semantics, adapted to Drizzle's function-based API (no IQueryable/LINQ).

## Files

| File Name                              | Description                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [batch-query.ts](src/batch-query.ts)   | `batchQuery()` + `DEFAULT_BATCH_SIZE` (500) — chunked IN-clause queries with ID deduplication and null filtering. |
| [batch-delete.ts](src/batch-delete.ts) | `batchDelete()` — chunked select-then-delete loop for purge/cleanup operations.                                   |
| [batch-result.ts](src/batch-result.ts) | `toBatchResult()`, `toBatchDictionaryResult()` — D2Result partial-success mapping.                                |
| [index.ts](src/index.ts)               | Barrel export of all utilities including `DEFAULT_BATCH_SIZE`.                                                    |

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

The default batch size is also exported as `DEFAULT_BATCH_SIZE` (500) for use by callers that need a consistent default (e.g., scheduled job handlers that pass batch size to `batchDelete`).

---

## Batch Deletes

Repeatedly selects a batch of IDs matching a condition, deletes them, and loops until exhausted. Avoids large transactions, unbounded deletes, and parameter-list overflows.

```typescript
const totalDeleted = await batchDelete(
  (limit) =>
    db
      .select({ id: expiredSessions.id })
      .from(expiredSessions)
      .where(lt(expiredSessions.expiresAt, now))
      .limit(limit)
      .then((rows) => rows.map((r) => r.id)),
  (ids) =>
    db
      .delete(expiredSessions)
      .where(inArray(expiredSessions.id, ids))
      .then(() => {}),
  500,
);
```

| Parameter     | Type                                | Description                                                  |
| ------------- | ----------------------------------- | ------------------------------------------------------------ |
| `selectBatch` | `(limit: number) => Promise<TId[]>` | Selects up to `batchSize` IDs matching the delete condition. |
| `deleteBatch` | `(ids: TId[]) => Promise<void>`     | Deletes the given IDs. Must handle FK ordering if needed.    |
| `batchSize`   | `number`                            | Maximum IDs per batch.                                       |

Returns the total number of rows deleted across all batches.

---

## Batch Result Mapping

Maps query results to D2Result with partial-success semantics.

| Result                   | D2Result                       |
| ------------------------ | ------------------------------ |
| 0 requested              | `Ok([])`                       |
| 0 found                  | `NotFound()`                   |
| Some found (< requested) | `SomeFound({ data: results })` |
| All found (= requested)  | `Ok({ data: results })`        |

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

| Node.js (`@d2/batch-pg`)         | .NET (`Batch.Pg`)              | Notes                                                 |
| -------------------------------- | ------------------------------ | ----------------------------------------------------- |
| `batchQuery(ids, queryFn, opts)` | `BatchGetByIds(ids, selector)` | Function vs fluent builder (no IQueryable in Drizzle) |
| `batchDelete(select, delete, n)` | `BatchDelete(select, delete)`  | Same select→delete loop pattern                       |
| `toBatchResult(results, count)`  | `ToD2ResultAsync(traceId, ct)` | Same Ok/SomeFound/NotFound semantics                  |
| `toBatchDictionaryResult()`      | `ToDictionaryD2ResultAsync()`  | Same Map/Dictionary semantics                         |
