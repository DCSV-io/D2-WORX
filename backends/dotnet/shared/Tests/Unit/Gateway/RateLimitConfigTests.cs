// -----------------------------------------------------------------------
// <copyright file="RateLimitConfigTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Gateway;

using D2.Shared.RateLimit.Default;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

/// <summary>
/// Validates that <see cref="RateLimitOptions"/> binds correctly from
/// flat key-value configuration entries and environment variables.
/// </summary>
public class RateLimitConfigTests
{
    private const string _SECTION = "GATEWAY_RATELIMIT";
    private const string _ENV_PREFIX = "D2TEST_RL_";

    #region Defaults

    /// <summary>
    /// Tests that <see cref="RateLimitOptions.Window"/> defaults to 1 minute.
    /// </summary>
    [Fact]
    public void Window_DefaultsToOneMinute_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new RateLimitOptions();
        config.GetSection(_SECTION).Bind(options);

        options.Window.Should().Be(TimeSpan.FromMinutes(1));
    }

    /// <summary>
    /// Tests that <see cref="RateLimitOptions.BlockDuration"/> defaults to 5 minutes.
    /// </summary>
    [Fact]
    public void BlockDuration_DefaultsToFiveMinutes_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new RateLimitOptions();
        config.GetSection(_SECTION).Bind(options);

        options.BlockDuration.Should().Be(TimeSpan.FromMinutes(5));
    }

    /// <summary>
    /// Tests that all threshold defaults match expected values when no config is present.
    /// </summary>
    [Fact]
    public void AllThresholds_DefaultToExpectedValues_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new RateLimitOptions();
        config.GetSection(_SECTION).Bind(options);

        options.ClientFingerprintThreshold.Should().Be(100);
        options.IpThreshold.Should().Be(5_000);
        options.CityThreshold.Should().Be(25_000);
        options.CountryThreshold.Should().Be(100_000);
    }

    /// <summary>
    /// Tests that <see cref="RateLimitOptions.WhitelistedCountryCodes"/> defaults to US, CA, GB.
    /// </summary>
    [Fact]
    public void WhitelistedCountryCodes_DefaultsToUsCaGb_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new RateLimitOptions();
        config.GetSection(_SECTION).Bind(options);

        options.WhitelistedCountryCodes.Should().HaveCount(3);
        options.WhitelistedCountryCodes.Should().BeEquivalentTo(["US", "CA", "GB"]);
    }

    #endregion

    #region In-Memory Binding

    /// <summary>
    /// Tests that TimeSpan properties bind from explicit config values.
    /// </summary>
    [Fact]
    public void TimeSpanProperties_BindFromExplicitConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"{_SECTION}:Window"] = "00:02:00",
                [$"{_SECTION}:BlockDuration"] = "00:15:00",
            })
            .Build();

        var options = new RateLimitOptions();
        config.GetSection(_SECTION).Bind(options);

        options.Window.Should().Be(TimeSpan.FromMinutes(2));
        options.BlockDuration.Should().Be(TimeSpan.FromMinutes(15));
    }

    /// <summary>
    /// Tests that all threshold properties bind from explicit config values.
    /// </summary>
    [Fact]
    public void AllThresholds_BindFromExplicitConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"{_SECTION}:ClientFingerprintThreshold"] = "200",
                [$"{_SECTION}:IpThreshold"] = "10000",
                [$"{_SECTION}:CityThreshold"] = "50000",
                [$"{_SECTION}:CountryThreshold"] = "200000",
            })
            .Build();

        var options = new RateLimitOptions();
        config.GetSection(_SECTION).Bind(options);

        options.ClientFingerprintThreshold.Should().Be(200);
        options.IpThreshold.Should().Be(10_000);
        options.CityThreshold.Should().Be(50_000);
        options.CountryThreshold.Should().Be(200_000);
    }

    /// <summary>
    /// Tests that <see cref="RateLimitOptions.WhitelistedCountryCodes"/> binds
    /// custom country codes from indexed config keys.
    /// Note: Bind() adds to pre-existing collections (does not clear defaults).
    /// </summary>
    [Fact]
    public void WhitelistedCountryCodes_BindsCustomList()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"{_SECTION}:WhitelistedCountryCodes:0"] = "DE",
                [$"{_SECTION}:WhitelistedCountryCodes:1"] = "FR",
                [$"{_SECTION}:WhitelistedCountryCodes:2"] = "JP",
            })
            .Build();

        var options = new RateLimitOptions();
        config.GetSection(_SECTION).Bind(options);

        // Bind() adds to existing List — defaults (US, CA, GB) remain.
        options.WhitelistedCountryCodes.Should().Contain("DE");
        options.WhitelistedCountryCodes.Should().Contain("FR");
        options.WhitelistedCountryCodes.Should().Contain("JP");
        options.WhitelistedCountryCodes.Should().Contain("US");
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
                $"{_ENV_PREFIX}{_SECTION}__Window", "00:03:00");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__BlockDuration", "00:10:00");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__ClientFingerprintThreshold", "50");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__IpThreshold", "2500");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__CityThreshold", "12500");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__CountryThreshold", "50000");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__WhitelistedCountryCodes__0", "AU");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__WhitelistedCountryCodes__1", "NZ");

            var config = new ConfigurationBuilder()
                .AddEnvironmentVariables(_ENV_PREFIX)
                .Build();

            var options = new RateLimitOptions();
            config.GetSection(_SECTION).Bind(options);

            options.Window.Should().Be(TimeSpan.FromMinutes(3));
            options.BlockDuration.Should().Be(TimeSpan.FromMinutes(10));
            options.ClientFingerprintThreshold.Should().Be(50);
            options.IpThreshold.Should().Be(2_500);
            options.CityThreshold.Should().Be(12_500);
            options.CountryThreshold.Should().Be(50_000);

            // Bind() adds to existing List — defaults (US, CA, GB) remain.
            options.WhitelistedCountryCodes.Should().Contain("AU");
            options.WhitelistedCountryCodes.Should().Contain("NZ");
            options.WhitelistedCountryCodes.Should().Contain("US");
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__Window", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__BlockDuration", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__ClientFingerprintThreshold", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__IpThreshold", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__CityThreshold", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__CountryThreshold", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__WhitelistedCountryCodes__0", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__WhitelistedCountryCodes__1", null);
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
                [$"{_SECTION}:ClientFingerprintThreshold"] = "250",
                [$"{_SECTION}:BlockDuration"] = "00:20:00",
            })
            .Build();

        var options = new RateLimitOptions();
        config.GetSection(_SECTION).Bind(options);

        // Overridden.
        options.ClientFingerprintThreshold.Should().Be(250);
        options.BlockDuration.Should().Be(TimeSpan.FromMinutes(20));

        // Defaults preserved.
        options.Window.Should().Be(TimeSpan.FromMinutes(1));
        options.IpThreshold.Should().Be(5_000);
        options.CityThreshold.Should().Be(25_000);
        options.CountryThreshold.Should().Be(100_000);
        options.WhitelistedCountryCodes.Should().BeEquivalentTo(["US", "CA", "GB"]);
    }

    #endregion
}
