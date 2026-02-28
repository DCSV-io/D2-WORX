// -----------------------------------------------------------------------
// <copyright file="RequestEnrichmentConfigTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Gateway;

using D2.Shared.RequestEnrichment.Default;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

/// <summary>
/// Validates that <see cref="RequestEnrichmentOptions"/> binds correctly from
/// flat key-value configuration entries and environment variables.
/// </summary>
public class RequestEnrichmentConfigTests
{
    private const string _SECTION = "GATEWAY_ENRICHMENT";
    private const string _ENV_PREFIX = "D2TEST_RE_";

    #region Defaults

    /// <summary>
    /// Tests that <see cref="RequestEnrichmentOptions.EnableWhoIsLookup"/> defaults to true.
    /// </summary>
    [Fact]
    public void EnableWhoIsLookup_DefaultsToTrue_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new RequestEnrichmentOptions();
        config.GetSection(_SECTION).Bind(options);

        options.EnableWhoIsLookup.Should().BeTrue();
    }

    /// <summary>
    /// Tests that <see cref="RequestEnrichmentOptions.ClientFingerprintHeader"/> defaults
    /// to "X-Client-Fingerprint".
    /// </summary>
    [Fact]
    public void ClientFingerprintHeader_DefaultsToXClientFingerprint_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new RequestEnrichmentOptions();
        config.GetSection(_SECTION).Bind(options);

        options.ClientFingerprintHeader.Should().Be("X-Client-Fingerprint");
    }

    /// <summary>
    /// Tests that <see cref="RequestEnrichmentOptions.TrustedProxyHeaders"/> defaults
    /// to only CfConnectingIp.
    /// </summary>
    [Fact]
    public void TrustedProxyHeaders_DefaultsToCfConnectingIpOnly_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new RequestEnrichmentOptions();
        config.GetSection(_SECTION).Bind(options);

        options.TrustedProxyHeaders.Should().ContainSingle()
            .Which.Should().Be(TrustedProxyHeader.CfConnectingIp);
    }

    /// <summary>
    /// Tests that <see cref="RequestEnrichmentOptions.MaxFingerprintLength"/> defaults to 256
    /// and <see cref="RequestEnrichmentOptions.MaxForwardedForLength"/> defaults to 2048.
    /// </summary>
    [Fact]
    public void MaxLengths_DefaultToExpectedValues_WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new RequestEnrichmentOptions();
        config.GetSection(_SECTION).Bind(options);

        options.MaxFingerprintLength.Should().Be(256);
        options.MaxForwardedForLength.Should().Be(2048);
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
                [$"{_SECTION}:EnableWhoIsLookup"] = "false",
                [$"{_SECTION}:ClientFingerprintHeader"] = "X-Custom-Fingerprint",
                [$"{_SECTION}:MaxFingerprintLength"] = "512",
                [$"{_SECTION}:MaxForwardedForLength"] = "4096",
            })
            .Build();

        var options = new RequestEnrichmentOptions();
        config.GetSection(_SECTION).Bind(options);

        options.EnableWhoIsLookup.Should().BeFalse();
        options.ClientFingerprintHeader.Should().Be("X-Custom-Fingerprint");
        options.MaxFingerprintLength.Should().Be(512);
        options.MaxForwardedForLength.Should().Be(4096);
    }

    /// <summary>
    /// Tests that <see cref="RequestEnrichmentOptions.TrustedProxyHeaders"/> binds
    /// multiple enum values from indexed config keys.
    /// </summary>
    [Fact]
    public void TrustedProxyHeaders_BindsMultipleHeaders()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"{_SECTION}:TrustedProxyHeaders:0"] = "CfConnectingIp",
                [$"{_SECTION}:TrustedProxyHeaders:1"] = "XRealIp",
                [$"{_SECTION}:TrustedProxyHeaders:2"] = "XForwardedFor",
            })
            .Build();

        var options = new RequestEnrichmentOptions();
        config.GetSection(_SECTION).Bind(options);

        options.TrustedProxyHeaders.Should().HaveCount(3);
        options.TrustedProxyHeaders.Should().BeEquivalentTo(
        [
            TrustedProxyHeader.CfConnectingIp,
            TrustedProxyHeader.XRealIp,
            TrustedProxyHeader.XForwardedFor,
        ]);
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
                $"{_ENV_PREFIX}{_SECTION}__EnableWhoIsLookup", "false");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__ClientFingerprintHeader", "X-Env-Fingerprint");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__MaxFingerprintLength", "128");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__MaxForwardedForLength", "1024");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__TrustedProxyHeaders__0", "XRealIp");
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__TrustedProxyHeaders__1", "XForwardedFor");

            var config = new ConfigurationBuilder()
                .AddEnvironmentVariables(_ENV_PREFIX)
                .Build();

            var options = new RequestEnrichmentOptions();
            config.GetSection(_SECTION).Bind(options);

            options.EnableWhoIsLookup.Should().BeFalse();
            options.ClientFingerprintHeader.Should().Be("X-Env-Fingerprint");
            options.MaxFingerprintLength.Should().Be(128);
            options.MaxForwardedForLength.Should().Be(1024);

            // Bind() adds to existing HashSet — default (CfConnectingIp) remains.
            options.TrustedProxyHeaders.Should().HaveCount(3);
            options.TrustedProxyHeaders.Should().BeEquivalentTo(
                [TrustedProxyHeader.CfConnectingIp, TrustedProxyHeader.XRealIp, TrustedProxyHeader.XForwardedFor]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__EnableWhoIsLookup", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__ClientFingerprintHeader", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__MaxFingerprintLength", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__MaxForwardedForLength", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__TrustedProxyHeaders__0", null);
            Environment.SetEnvironmentVariable(
                $"{_ENV_PREFIX}{_SECTION}__TrustedProxyHeaders__1", null);
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
                [$"{_SECTION}:MaxFingerprintLength"] = "64",
            })
            .Build();

        var options = new RequestEnrichmentOptions();
        config.GetSection(_SECTION).Bind(options);

        // Overridden.
        options.MaxFingerprintLength.Should().Be(64);

        // Defaults preserved.
        options.EnableWhoIsLookup.Should().BeTrue();
        options.ClientFingerprintHeader.Should().Be("X-Client-Fingerprint");
        options.MaxForwardedForLength.Should().Be(2048);
        options.TrustedProxyHeaders.Should().ContainSingle()
            .Which.Should().Be(TrustedProxyHeader.CfConnectingIp);
    }

    #endregion
}
