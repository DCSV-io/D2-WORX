// -----------------------------------------------------------------------
// <copyright file="SharedPostgresFixture.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Fixtures;

using D2.Geo.Infra.Repository;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Testcontainers.PostgreSql;
using Xunit;

/// <summary>
/// Shared PostgreSQL container fixture for integration tests.
/// Container is started once and shared across all tests in the collection.
/// </summary>
[MustDisposeResource(false)]
public class SharedPostgresFixture : IAsyncLifetime
{
    private PostgreSqlContainer _container = null!;

    /// <summary>
    /// Gets the connection string for the shared PostgreSQL container.
    /// </summary>
    public string ConnectionString => _container.GetConnectionString();

    /// <summary>
    /// Creates a new DbContext instance connected to the shared container.
    /// Each test should create its own DbContext to avoid state leakage.
    /// </summary>
    ///
    /// <returns>
    /// A new <see cref="GeoDbContext"/> instance.
    /// </returns>
    public GeoDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GeoDbContext>()
            .UseNpgsql(ConnectionString)
            .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new GeoDbContext(options);
    }

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        _container = new PostgreSqlBuilder()
            .WithImage("postgres:18")
            .Build();
        await _container.StartAsync();

        // Run migrations once for the shared container
        await using var db = CreateDbContext();
        await db.Database.MigrateAsync();
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}
