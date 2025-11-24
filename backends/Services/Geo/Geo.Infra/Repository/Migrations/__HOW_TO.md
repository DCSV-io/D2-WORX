# How To: Create Migrations

## Prerequisites

Install EF Core CLI tools:
```bash
dotnet tool install --global dotnet-ef
```

## Create a Migration

Run the following command in the terminal at this directory in project (`/Repository/Migrations/`):
```bash
_create_migration.bat <MigrationName>
```

**Example:**
```bash
_create_migration.bat InitialCreate
```

## Remove Last Migration

If you need to remove a migration that hasn't been committed yet:
```bash
_rollback_migration.bat
```

**Note:** This only adds and removes migration files. The migrations themselves must still be applied to the database. This will happen automatically on application startup if configured.
