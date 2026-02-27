# @d2/repository-pg

Shared PostgreSQL repository utilities for Node.js services. Provides error predicates, batch query helpers, and result mapping. Mirrors .NET `Batch.Pg` and `Errors.Pg`.

## Files

| File Name                                  | Description                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [pg-errors.ts](src/pg-errors.ts)           | PostgreSQL error code predicates (`isPgUniqueViolation`, `isPgForeignKeyViolation`, etc.).     |
| [batch-query.ts](src/batch-query.ts)       | `batchQuery()` — chunked IN-clause queries with ID deduplication and null filtering.          |
| [batch-result.ts](src/batch-result.ts)     | `toBatchResult()`, `toBatchDictionaryResult()` — D2Result partial-success mapping.            |
| [index.ts](src/index.ts)                   | Barrel export of all utilities.                                                               |

---

## Error Predicates

Inspect `node-postgres` errors for specific PostgreSQL error codes.

| Function                  | PG Code | Use Case                    |
| ------------------------- | ------- | --------------------------- |
| `isPgUniqueViolation`     | `23505` | Duplicate key (email, etc.) |
| `isPgForeignKeyViolation` | `23503` | Missing referenced row      |
| `isPgNotNullViolation`    | `23502` | Required column is null     |
| `isPgCheckViolation`      | `23514` | CHECK constraint failed     |

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

| Option           | Default | Description                                    |
| ---------------- | ------- | ---------------------------------------------- |
| `batchSize`      | `500`   | Max IDs per IN-clause chunk                    |
| `deduplicateIds` | `true`  | Remove duplicate IDs before chunking           |
| `filterNullIds`  | `true`  | Remove null/undefined IDs before chunking      |

---

## Batch Result Mapping

Maps query results to D2Result with partial-success semantics.

| Result                       | D2Result                               |
| ---------------------------- | -------------------------------------- |
| 0 requested                  | `Ok([])`                               |
| 0 found                      | `NotFound()`                           |
| Some found (< requested)     | `SomeFound({ data: results })`         |
| All found (= requested)      | `Ok({ data: results })`               |

```typescript
const result = toBatchResult(rows, requestedIds.length);
// result.success === true, result.statusCode === "SOME_FOUND"
```

Dictionary variant for key-value results:

```typescript
const result = toBatchDictionaryResult(resultMap, requestedKeys.length);
```

---

## Transactions

No transaction wrapper is provided. Drizzle's native `db.transaction()` handles this OOTB:

```typescript
await db.transaction(async (tx) => {
  await tx.insert(users).values({ ... });
  await tx.insert(accounts).values({ ... });
  // auto-commits on success, auto-rollbacks on throw
});
```

The .NET side needs explicit `Begin`/`Commit`/`Rollback` handlers (`Transactions.Pg`) because EF Core's `SaveChangesAsync()` commits immediately unless wrapped in an explicit transaction. Drizzle's callback-based API already provides atomic semantics without additional infrastructure.

---

## .NET Equivalent

| Node.js (`@d2/repository-pg`)  | .NET Project         | Notes                                          |
| ------------------------------ | -------------------- | ---------------------------------------------- |
| `isPgUniqueViolation`, etc.    | `Errors.Pg`          | Same PG error codes, different exception types |
| `batchQuery`, `toBatchResult`  | `Batch.Pg`           | Same chunking/dedup, different query APIs      |
| _(Drizzle OOTB)_              | `Transactions.Pg`    | Drizzle's `db.transaction()` is sufficient     |
