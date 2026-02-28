# D2.Shared.Repository.Errors.Pg

PostgreSQL error code predicates for constraint violation handling. Mirrors `@d2/errors-pg` (Node.js) error helpers, providing cross-platform parity.

## Purpose

Services catch database constraint violations and return structured `D2Result` failures (409 Conflict, 422, etc.) instead of propagating raw 500 errors. These static predicates inspect the PostgreSQL error code from Npgsql exceptions, including when wrapped by EF Core's `DbUpdateException`.

## API

| Method                    | PG Code | Use Case                        |
| ------------------------- | ------- | ------------------------------- |
| `IsUniqueViolation()`     | `23505` | Duplicate key → 409 Conflict    |
| `IsForeignKeyViolation()` | `23503` | Missing parent row → 422 or 404 |
| `IsNotNullViolation()`    | `23502` | Required field missing → 422    |
| `IsCheckViolation()`      | `23514` | Domain constraint failed → 422  |

## Usage

```csharp
try
{
    await dbContext.SaveChangesAsync(ct);
    return D2Result<Entity?>.Ok(entity, traceId: TraceId);
}
catch (Exception ex) when (PgErrorCodes.IsUniqueViolation(ex))
{
    return D2Result<Entity?>.Fail(
        ["Entity with this key already exists."],
        HttpStatusCode.Conflict,
        ErrorCodes.DUPLICATE,
        traceId: TraceId);
}
```

## Cross-Platform Parity

| .NET                                     | Node.js (`@d2/errors-pg`)      |
| ---------------------------------------- | ------------------------------ |
| `PgErrorCodes.IsUniqueViolation(ex)`     | `isPgUniqueViolation(err)`     |
| `PgErrorCodes.IsForeignKeyViolation(ex)` | `isPgForeignKeyViolation(err)` |
| `PgErrorCodes.IsNotNullViolation(ex)`    | `isPgNotNullViolation(err)`    |
| `PgErrorCodes.IsCheckViolation(ex)`      | `isPgCheckViolation(err)`      |

Both check the direct exception and wrapped inner exceptions for compatibility with their respective ORMs (EF Core wraps in `DbUpdateException`, Drizzle wraps in `DrizzleQueryError`).
