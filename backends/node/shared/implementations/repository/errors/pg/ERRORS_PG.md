# @d2/errors-pg

PostgreSQL error code predicates for constraint violation handling. Mirrors .NET `Errors.Pg` — same PG error codes, adapted for node-postgres/Drizzle error shapes.

## Files

| File Name                              | Description                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| [pg-errors.ts](src/pg-errors.ts)       | PostgreSQL error code predicates (`isPgUniqueViolation`, `isPgForeignKeyViolation`, etc.). |
| [index.ts](src/index.ts)               | Barrel export of all predicates.                                                          |

---

## Error Predicates

Inspect `node-postgres` errors for specific PostgreSQL error codes. Checks both direct errors and Drizzle 0.45+ `DrizzleQueryError` wrappers (original in `.cause`).

| Function                  | PG Code | Use Case                    |
| ------------------------- | ------- | --------------------------- |
| `isPgUniqueViolation`     | `23505` | Duplicate key (email, etc.) |
| `isPgForeignKeyViolation` | `23503` | Missing referenced row      |
| `isPgNotNullViolation`    | `23502` | Required column is null     |
| `isPgCheckViolation`      | `23514` | CHECK constraint failed     |

## Usage

```typescript
import { isPgUniqueViolation } from "@d2/errors-pg";

try {
  await db.insert(users).values({ email });
  return D2Result.ok({ data: user });
} catch (err) {
  if (isPgUniqueViolation(err)) {
    return D2Result.fail(
      ["User with this email already exists."],
      HttpStatusCode.Conflict,
      ErrorCodes.DUPLICATE,
    );
  }
  throw err;
}
```

---

## .NET Equivalent

| Node.js (`@d2/errors-pg`)         | .NET (`Errors.Pg`)                     |
| ---------------------------------- | -------------------------------------- |
| `isPgUniqueViolation(err)`         | `PgErrorCodes.IsUniqueViolation(ex)`   |
| `isPgForeignKeyViolation(err)`     | `PgErrorCodes.IsForeignKeyViolation(ex)` |
| `isPgNotNullViolation(err)`        | `PgErrorCodes.IsNotNullViolation(ex)`  |
| `isPgCheckViolation(err)`          | `PgErrorCodes.IsCheckViolation(ex)`    |

Both check the direct exception and wrapped inner exceptions for compatibility with their respective ORMs (EF Core wraps in `DbUpdateException`, Drizzle wraps in `DrizzleQueryError`).
