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

    private void SetEnv(string key, string value)
    {
        Environment.SetEnvironmentVariable(key, value);
        _envKeysSet.Add(key);
    }

    #region ParseRedisUri

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
}
