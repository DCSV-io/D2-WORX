// -----------------------------------------------------------------------
// <copyright file="DatabaseHelper.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.DatabaseStartup.Pg;

using Npgsql;

/// <summary>
/// Provides helpers for database startup operations such as ensuring a database exists.
/// </summary>
public static class DatabaseHelper
{
    /// <summary>
    /// Ensures the target database exists by connecting to the default <c>postgres</c>
    /// database and issuing <c>CREATE DATABASE</c>. Idempotent — safe to call on every startup.
    /// </summary>
    /// <param name="connectionString">The connection string for the target database.</param>
    /// <param name="logger">Optional action to log informational messages.</param>
    /// <returns>A task representing the asynchronous operation.</returns>
    /// <exception cref="InvalidOperationException">
    /// Thrown when the connection string does not contain a database name.
    /// </exception>
    public static async Task EnsureDatabaseExistsAsync(
        string connectionString,
        Action<string>? logger = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var dbName = builder.Database;

        if (string.IsNullOrEmpty(dbName))
        {
            throw new InvalidOperationException("No database name found in connection string");
        }

        // Connect to the default 'postgres' database
        builder.Database = "postgres";
        await using var connection = new NpgsqlConnection(builder.ToString());
        await connection.OpenAsync();

        // Check if database exists
        await using var checkCmd = connection.CreateCommand();
        checkCmd.CommandText = "SELECT 1 FROM pg_database WHERE datname = @dbName";
        checkCmd.Parameters.AddWithValue("dbName", dbName);
        var exists = await checkCmd.ExecuteScalarAsync();

        if (exists is null)
        {
            await using var createCmd = connection.CreateCommand();
            createCmd.CommandText = $"CREATE DATABASE \"{dbName}\"";
            await createCmd.ExecuteNonQueryAsync();
            logger?.Invoke($"Created database \"{dbName}\"");
        }
        else
        {
            logger?.Invoke($"Database \"{dbName}\" already exists");
        }
    }
}
