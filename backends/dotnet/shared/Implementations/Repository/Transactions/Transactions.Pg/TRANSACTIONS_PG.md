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
