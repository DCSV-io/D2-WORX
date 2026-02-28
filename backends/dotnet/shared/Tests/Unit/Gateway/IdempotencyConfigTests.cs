// -----------------------------------------------------------------------
// <copyright file="IdempotencyConfigTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Gateway;

using D2.Shared.Idempotency.Default;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

/// <summary>
/// Validates that <see cref="IdempotencyOptions"/> binds correctly from
/// flat key-value configuration entries and environment variables.
/// </summary>
public class IdempotencyConfigTests
{
    private const string _SECTION = "GATEWAY_IDEMPOTENCY";
    private const string _ENV_PREFIX = "D2TEST_ID_";

    #region Defaults

    /// <summary>
    /// Tests that <see cref="IdempotencyOptions.CacheTtl"/> defaults to 24 hours.
    /// </summary>
    [Fact]
    public void CacheTtl_DefaultsTo24Hours_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new IdempotencyOptions();
        config.GetSection(_SECTION).Bind(options);

        options.CacheTtl.Should().Be(TimeSpan.FromHours(24));
    }

    /// <summary>
    /// Tests that <see cref="IdempotencyOptions.InFlightTtl"/> defaults to 30 seconds.
    /// </summary>
    [Fact]
    public void InFlightTtl_DefaultsTo30Seconds_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new IdempotencyOptions();
        config.GetSection(_SECTION).Bind(options);

        options.InFlightTtl.Should().Be(TimeSpan.FromSeconds(30));
    }

    /// <summary>
    /// Tests that <see cref="IdempotencyOptions.MaxBodySizeBytes"/> defaults to 1 MB (1,048,576 bytes).
    /// </summary>
    [Fact]
    public void MaxBodySizeBytes_DefaultsTo1MB_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new IdempotencyOptions();
        config.GetSection(_SECTION).Bind(options);

        options.MaxBodySizeBytes.Should().Be(1_048_576);
    }

    /// <summary>
    /// Tests that <see cref="IdempotencyOptions.ApplicableMethods"/> defaults to POST, PUT, PATCH, DELETE.
    /// </summary>
    [Fact]
    public void ApplicableMethods_DefaultsToPostPutPatchDelete_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new IdempotencyOptions();
        config.GetSection(_SECTION).Bind(options);

        options.ApplicableMethods.Should().HaveCount(4);
        options.ApplicableMethods.Should().BeEquivalentTo(["POST", "PUT", "PATCH", "DELETE"]);
    }

    /// <summary>
    /// Tests that <see cref="IdempotencyOptions.CacheErrorResponses"/> defaults to false.
    /// </summary>
    [Fact]
    public void CacheErrorResponses_DefaultsToFalse_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new IdempotencyOptions();
        config.GetSection(_SECTION).Bind(options);

        options.CacheErrorResponses.Should().BeFalse();
    }

    #endregion

    #region In-Memory Binding

    /// <summary>
    /// Tests that all scalar properties bind from explicit config values.
    /// </summary>
    [Fact]
    public void AllScalarProperties_BindFromExplicitConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"{_SECTION}:CacheTtl"] = "12:00:00",
                [$"{_SECTION}:InFlightTtl"] = "00:01:00",
                [$"{_SECTION}:MaxBodySizeBytes"] = "524288",
                [$"{_SECTION}:CacheErrorResponses"] = "true",
            })
            .Build();

        var options = new IdempotencyOptions();
        config.GetSection(_SECTION).Bind(options);

        options.CacheTtl.Should().Be(TimeSpan.FromHours(12));
        options.InFlightTtl.Should().Be(TimeSpan.FromMinutes(1));
        options.MaxBodySizeBytes.Should().Be(524_288);
        options.CacheErrorResponses.Should().BeTrue();
    }

    /// <summary>
    /// Tests that <see cref="IdempotencyOptions.ApplicableMethods"/> binds
    /// additional methods from indexed config keys.
    /// Note: Bind() adds to pre-existing HashSet (does not clear defaults).
    /// </summary>
    [Fact]
    public void ApplicableMethods_BindsAdditionalMethods()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"{_SECTION}:ApplicableMethods:0"] = "OPTIONS",
                [$"{_SECTION}:ApplicableMethods:1"] = "HEAD",
            })
            .Build();

        var options = new IdempotencyOptions();
        config.GetSection(_SECTION).Bind(options);

        // Bind() adds to existing HashSet — defaults (POST, PUT, PATCH, DELETE) remain.
        options.ApplicableMethods.Should().Contain("OPTIONS");
        options.ApplicableMethods.Should().Contain("HEAD");
        options.ApplicableMethods.Should().Contain("POST");
        options.ApplicableMethods.Should().HaveCount(6);
    }

    #endregion

    #region Environment Variable Binding

    /// <summary>
    /// Tests that all properties bind from environment variable format using __ as separator.
    /// </summary>
    [Fact]
    public void AllProperties_BindFromEnvironmentVariableFormat()
    {
        try
        {
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__CacheTtl", "06:00:00");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__InFlightTtl", "00:00:45");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__MaxBodySizeBytes", "2097152");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__CacheErrorResponses", "true");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__ApplicableMethods__0", "OPTIONS");

            var config = new ConfigurationBuilder()
                .AddEnvironmentVariables(_ENV_PREFIX)
                .Build();

            var options = new IdempotencyOptions();
            config.GetSection(_SECTION).Bind(options);

            options.CacheTtl.Should().Be(TimeSpan.FromHours(6));
            options.InFlightTtl.Should().Be(TimeSpan.FromSeconds(45));
            options.MaxBodySizeBytes.Should().Be(2_097_152);
            options.CacheErrorResponses.Should().BeTrue();

            // Bind() adds to existing HashSet — defaults remain. OPTIONS is new.
            options.ApplicableMethods.Should().Contain("OPTIONS");
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__CacheTtl", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__InFlightTtl", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__MaxBodySizeBytes", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__CacheErrorResponses", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__ApplicableMethods__0", null);
        }
    }

    /// <summary>
    /// Tests that partial config only overrides specified properties, leaving others at defaults.
    /// </summary>
    [Fact]
    public void PartialConfig_PreservesUnsetDefaults()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"{_SECTION}:MaxBodySizeBytes"] = "262144",
                [$"{_SECTION}:CacheErrorResponses"] = "true",
            })
            .Build();

        var options = new IdempotencyOptions();
        config.GetSection(_SECTION).Bind(options);

        // Overridden.
        options.MaxBodySizeBytes.Should().Be(262_144);
        options.CacheErrorResponses.Should().BeTrue();

        // Defaults preserved.
        options.CacheTtl.Should().Be(TimeSpan.FromHours(24));
        options.InFlightTtl.Should().Be(TimeSpan.FromSeconds(30));
        options.ApplicableMethods.Should().HaveCount(4);
        options.ApplicableMethods.Should().BeEquivalentTo(["POST", "PUT", "PATCH", "DELETE"]);
    }

    #endregion
}
