# Transactions.Pg

PostgreSQL database transaction management handlers implementing ITransaction interface for explicit transaction control using Entity Framework Core.

## Files

| File Name                      | Description                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| [Extensions.cs](Extensions.cs) | DI extension method AddPgTransactions registering transaction handlers with DbContext for dependency injection. |

## Transactions

| File Name                               | Description                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [Begin.cs](Transactions/Begin.cs)       | Handler for beginning a database transaction using DbContext.Database.BeginTransactionAsync.               |
| [Commit.cs](Transactions/Commit.cs)     | Handler for committing an active database transaction using DbContext.Database.CommitTransactionAsync.     |
| [Rollback.cs](Transactions/Rollback.cs) | Handler for rolling back an active database transaction using DbContext.Database.RollbackTransactionAsync. |

## Transaction Flow

Begin → operations → Commit (or Rollback on failure). All steps go through handler abstractions:

```csharp
// Begin transaction (default: ReadCommitted isolation)
var beginResult = await r_begin.HandleAsync(new ITransaction.BeginInput(), ct);
if (beginResult.Failed) return D2Result.BubbleFail(beginResult);

try
{
    // Perform database operations within the transaction
    _db.Entities.Add(new Entity { Id = id, Name = name });
    await _db.SaveChangesAsync(ct);

    // Additional operations...

    // Commit — all operations persist atomically
    var commitResult = await r_commit.HandleAsync(new ITransaction.CommitInput(), ct);
    if (commitResult.Failed) return D2Result.BubbleFail(commitResult);

    return D2Result<MyOutput?>.Ok(new MyOutput(id));
}
catch (Exception)
{
    // Rollback — all operations are discarded
    await r_rollback.HandleAsync(new ITransaction.RollbackInput(), ct);
    throw;
}
```

**Key behaviors:**
- `Begin` accepts an isolation level (defaults to `ReadCommitted`)
- `Commit` persists all operations atomically
- `Rollback` discards all operations — data is NOT persisted
- All three handlers wrap `DbContext.Database.*TransactionAsync`
- DI registration: `services.AddPgTransactions<TDbContext>()` registers all three
