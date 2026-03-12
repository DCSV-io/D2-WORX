// -----------------------------------------------------------------------
// <copyright file="ConnectionStringHelperTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit;

using D2.Shared.Utilities.Configuration;
using FluentAssertions;

/// <summary>
/// Unit tests for <see cref="ConnectionStringHelper"/>.
/// </summary>
public class ConnectionStringHelperTests : IDisposable
{
    private readonly List<string> _envKeysSet = [];

    /// <inheritdoc />
    public void Dispose()
    {
        foreach (var key in _envKeysSet)
        {
            Environment.SetEnvironmentVariable(key, null);
        }
    }

    #region ParseRedisUri

    /// <summary>
    /// Tests that a Redis URI with a password is parsed to StackExchange format.
    /// </summary>
    [Fact]
    public void ParseRedisUri_WithPassword_ReturnsStackExchangeFormat()
    {
        // Arrange
        const string uri = "redis://:d2-cache-p455@localhost:6379";

        // Act
        var result = ConnectionStringHelper.ParseRedisUri(uri);

        // Assert
        result.Should().Be("localhost:6379,password=d2-cache-p455");
    }

    /// <summary>
    /// Tests that a Redis URI without a password returns just host:port.
    /// </summary>
    [Fact]
    public void ParseRedisUri_WithoutPassword_ReturnsHostPort()
    {
        // Arrange
        const string uri = "redis://localhost:6379";

        // Act
        var result = ConnectionStringHelper.ParseRedisUri(uri);

        // Assert
        result.Should().Be("localhost:6379");
    }

    /// <summary>
    /// Tests that a Redis URI with user and password extracts only the password.
    /// </summary>
    [Fact]
    public void ParseRedisUri_WithUserAndPassword_ExtractsPassword()
    {
        // Arrange
        const string uri = "redis://default:s3cr3t@redis-host:6380";

        // Act
        var result = ConnectionStringHelper.ParseRedisUri(uri);

        // Assert
        result.Should().Be("redis-host:6380,password=s3cr3t");
    }

    /// <summary>
    /// Tests that a Redis URI with URL-encoded password decodes properly.
    /// </summary>
    [Fact]
    public void ParseRedisUri_WithUrlEncodedPassword_DecodesPassword()
    {
        // Arrange
        const string uri = "redis://:p%40ss%3Dw%2Frd@localhost:6379";

        // Act
        var result = ConnectionStringHelper.ParseRedisUri(uri);

        // Assert
        result.Should().Be("localhost:6379,password=p@ss=w/rd");
    }

    /// <summary>
    /// Tests that a value already in StackExchange format passes through unchanged.
    /// </summary>
    [Fact]
    public void ParseRedisUri_AlreadyStackExchangeFormat_PassesThrough()
    {
        // Arrange
        const string se = "localhost:6379,password=secret";

        // Act
        var result = ConnectionStringHelper.ParseRedisUri(se);

        // Assert
        result.Should().Be(se);
    }

    /// <summary>
    /// Tests that a Redis URI without an explicit port defaults to 6379.
    /// </summary>
    [Fact]
    public void ParseRedisUri_DefaultPort_Uses6379()
    {
        // Arrange — System.Uri normalizes redis://localhost to port -1.
        const string uri = "redis://localhost";

        // Act
        var result = ConnectionStringHelper.ParseRedisUri(uri);

        // Assert
        result.Should().Be("localhost:6379");
    }

    #endregion

    #region ParsePostgresUri

    /// <summary>
    /// Tests that a full PostgreSQL URI is parsed to ADO.NET format.
    /// </summary>
    [Fact]
    public void ParsePostgresUri_FullUri_ReturnsAdoNetFormat()
    {
        // Arrange
        const string uri = "postgresql://d2-db-user:d2-db-p455@localhost:54320/d2-services-geo";

        // Act
        var result = ConnectionStringHelper.ParsePostgresUri(uri);

        // Assert
        result.Should().Be(
            "Host=localhost;Port=54320;Username=d2-db-user;Password=d2-db-p455;Database=d2-services-geo");
    }

    /// <summary>
    /// Tests that the postgres:// scheme (without 'ql') is also accepted.
    /// </summary>
    [Fact]
    public void ParsePostgresUri_PostgresScheme_AlsoWorks()
    {
        // Arrange
        const string uri = "postgres://admin:pass@db:5432/mydb";

        // Act
        var result = ConnectionStringHelper.ParsePostgresUri(uri);

        // Assert
        result.Should().Be("Host=db;Port=5432;Username=admin;Password=pass;Database=mydb");
    }

    /// <summary>
    /// Tests that URL-encoded credentials in a PostgreSQL URI are decoded.
    /// </summary>
    [Fact]
    public void ParsePostgresUri_UrlEncodedCredentials_Decodes()
    {
        // Arrange
        const string uri = "postgresql://admin%40corp:p%40ss%3Dword@db:5432/app";

        // Act
        var result = ConnectionStringHelper.ParsePostgresUri(uri);

        // Assert
        result.Should().Be("Host=db;Port=5432;Username=admin@corp;Password=p@ss=word;Database=app");
    }

    /// <summary>
    /// Tests that a PostgreSQL URI without an explicit port defaults to 5432.
    /// </summary>
    [Fact]
    public void ParsePostgresUri_DefaultPort_Uses5432()
    {
        // Arrange — omitting the port defaults to 5432.
        const string uri = "postgresql://user:pass@localhost/mydb";

        // Act
        var result = ConnectionStringHelper.ParsePostgresUri(uri);

        // Assert
        result.Should().Contain("Port=5432");
    }

    /// <summary>
    /// Tests that a value already in ADO.NET format passes through unchanged.
    /// </summary>
    [Fact]
    public void ParsePostgresUri_AlreadyAdoNetFormat_PassesThrough()
    {
        // Arrange
        const string ado = "Host=localhost;Port=5432;Username=admin;Password=secret;Database=mydb";

        // Act
        var result = ConnectionStringHelper.ParsePostgresUri(ado);

        // Assert
        result.Should().Be(ado);
    }

    /// <summary>
    /// Tests that the scheme comparison is case-insensitive.
    /// </summary>
    [Fact]
    public void ParsePostgresUri_CaseInsensitiveScheme_Parses()
    {
        // Arrange
        const string uri = "POSTGRESQL://user:pass@host:5432/db";

        // Act
        var result = ConnectionStringHelper.ParsePostgresUri(uri);

        // Assert
        result.Should().Contain("Host=host");
    }

    #endregion

    #region GetRedis

    /// <summary>
    /// Tests that GetRedis returns the parsed Redis connection string from the environment variable.
    /// </summary>
    [Fact]
    public void GetRedis_WhenEnvVarSet_ReturnsParsedValue()
    {
        // Arrange
        SetEnv("REDIS_URL", "redis://:my-password@redis-host:6380");

        // Act
        var result = ConnectionStringHelper.GetRedis();

        // Assert
        result.Should().Be("redis-host:6380,password=my-password");
    }

    /// <summary>
    /// Tests that GetRedis throws when the environment variable is not set.
    /// </summary>
    [Fact]
    public void GetRedis_WhenEnvVarMissing_ThrowsInvalidOperationException()
    {
        // Arrange — ensure the env var is not set.
        Environment.SetEnvironmentVariable("REDIS_URL", null);

        // Act
        var act = ConnectionStringHelper.GetRedis;

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*REDIS_URL*");
    }

    #endregion

    #region GetPostgres

    /// <summary>
    /// Tests that GetPostgres returns the parsed PostgreSQL connection string from the environment variable.
    /// </summary>
    [Fact]
    public void GetPostgres_WhenEnvVarSet_ReturnsParsedValue()
    {
        // Arrange
        SetEnv("GEO_DATABASE_URL", "postgresql://user:pass@localhost:54320/geo-db");

        // Act
        var result = ConnectionStringHelper.GetPostgres("GEO_DATABASE_URL");

        // Assert
        result.Should().Be("Host=localhost;Port=54320;Username=user;Password=pass;Database=geo-db");
    }

    /// <summary>
    /// Tests that GetPostgres throws when the environment variable is not set.
    /// </summary>
    [Fact]
    public void GetPostgres_WhenEnvVarMissing_ThrowsWithVarName()
    {
        // Arrange
        Environment.SetEnvironmentVariable("AUTH_DATABASE_URL", null);

        // Act
        var act = () => ConnectionStringHelper.GetPostgres("AUTH_DATABASE_URL");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*AUTH_DATABASE_URL*");
    }

    #endregion

    #region GetRabbitMq

    /// <summary>
    /// Tests that GetRabbitMq returns the raw connection string from the environment variable.
    /// </summary>
    [Fact]
    public void GetRabbitMq_WhenEnvVarSet_ReturnsRawValue()
    {
        // Arrange
        SetEnv("RABBITMQ_URL", "amqp://user:pass@localhost:5672");

        // Act
        var result = ConnectionStringHelper.GetRabbitMq();

        // Assert
        result.Should().Be("amqp://user:pass@localhost:5672");
    }

    /// <summary>
    /// Tests that GetRabbitMq throws when the environment variable is not set.
    /// </summary>
    [Fact]
    public void GetRabbitMq_WhenEnvVarMissing_ThrowsInvalidOperationException()
    {
        // Arrange
        Environment.SetEnvironmentVariable("RABBITMQ_URL", null);

        // Act
        var act = ConnectionStringHelper.GetRabbitMq;

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*RABBITMQ_URL*");
    }

    #endregion

    #region Helpers

    private void SetEnv(string key, string value)
    {
        Environment.SetEnvironmentVariable(key, value);
        _envKeysSet.Add(key);
    }

    #endregion
}
