// -----------------------------------------------------------------------
// <copyright file="ConfigBindingTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit;

using D2.Geo.App;
using D2.Geo.Client;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

/// <summary>
/// Validates that <see cref="GeoAppOptions"/> and <see cref="GeoClientOptions"/>
/// bind correctly from flat key-value configuration entries.
/// This proves the .env → D2Env → IConfiguration → Options binding chain works
/// for complex types like <c>Dictionary&lt;string, List&lt;string&gt;&gt;</c>.
/// </summary>
public class ConfigBindingTests
{
    #region GeoAppOptions — ApiKeyMappings (Dictionary<string, List<string>>)

    /// <summary>
    /// Tests that a single API key with multiple context keys binds correctly
    /// from indexed flat config keys to <see cref="GeoAppOptions.ApiKeyMappings"/>.
    /// </summary>
    [Fact]
    public void GeoAppOptions_ApiKeyMappings_BindsSingleKeyWithMultipleContextKeys()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GeoAppOptions:ApiKeyMappings:dev-auth-api-key:0"] = "org_contact",
                ["GeoAppOptions:ApiKeyMappings:dev-auth-api-key:1"] = "user",
            })
            .Build();

        var options = new GeoAppOptions();
        config.GetSection(nameof(GeoAppOptions)).Bind(options);

        options.ApiKeyMappings.Should().ContainKey("dev-auth-api-key");
        options.ApiKeyMappings["dev-auth-api-key"]
            .Should().BeEquivalentTo(["org_contact", "user"]);
    }

    /// <summary>
    /// Tests that multiple API keys each with their own context keys bind correctly.
    /// </summary>
    [Fact]
    public void GeoAppOptions_ApiKeyMappings_BindsMultipleApiKeys()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GeoAppOptions:ApiKeyMappings:auth-key:0"] = "org_contact",
                ["GeoAppOptions:ApiKeyMappings:auth-key:1"] = "user",
                ["GeoAppOptions:ApiKeyMappings:billing-key:0"] = "billing_contact",
            })
            .Build();

        var options = new GeoAppOptions();
        config.GetSection(nameof(GeoAppOptions)).Bind(options);

        options.ApiKeyMappings.Should().HaveCount(2);
        options.ApiKeyMappings["auth-key"]
            .Should().BeEquivalentTo(["org_contact", "user"]);
        options.ApiKeyMappings["billing-key"]
            .Should().BeEquivalentTo(["billing_contact"]);
    }

    /// <summary>
    /// Tests that when no ApiKeyMappings config keys are present, the dictionary remains empty.
    /// </summary>
    [Fact]
    public void GeoAppOptions_ApiKeyMappings_DefaultsToEmptyWhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new GeoAppOptions();
        config.GetSection(nameof(GeoAppOptions)).Bind(options);

        options.ApiKeyMappings.Should().BeEmpty();
    }

    #endregion

    #region GeoAppOptions — Environment Variable Simulation

    /// <summary>
    /// Tests that environment variable format keys (using __ as separator) bind correctly
    /// to <see cref="GeoAppOptions.ApiKeyMappings"/>. This simulates what D2Env produces.
    /// </summary>
    [Fact]
    public void GeoAppOptions_ApiKeyMappings_BindsFromEnvironmentVariableFormat()
    {
        // D2Env produces: GEOAPPOPTIONS__APIKEYMAPPINGS__dev-auth-api-key__0=org_contact
        // .NET env var provider converts __ to : automatically.
        // AddEnvironmentVariables reads these and feeds them to IConfiguration.
        const string prefix = "D2TEST_CFGBIND_";

        try
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoAppOptions__ApiKeyMappings__dev-auth-api-key__0", "org_contact");
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoAppOptions__ApiKeyMappings__dev-auth-api-key__1", "user");

            var config = new ConfigurationBuilder()
                .AddEnvironmentVariables(prefix)
                .Build();

            var options = new GeoAppOptions();
            config.GetSection(nameof(GeoAppOptions)).Bind(options);

            options.ApiKeyMappings.Should().ContainKey("dev-auth-api-key");
            options.ApiKeyMappings["dev-auth-api-key"]
                .Should().BeEquivalentTo(["org_contact", "user"]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoAppOptions__ApiKeyMappings__dev-auth-api-key__0", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoAppOptions__ApiKeyMappings__dev-auth-api-key__1", null);
        }
    }

    #endregion

    #region GeoClientOptions — ApiKey (string)

    /// <summary>
    /// Tests that <see cref="GeoClientOptions.ApiKey"/> binds from a flat config key.
    /// </summary>
    [Fact]
    public void GeoClientOptions_ApiKey_BindsFromFlatConfigKey()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GeoClientOptions:ApiKey"] = "dev-auth-api-key",
            })
            .Build();

        var options = new GeoClientOptions();
        config.GetSection(nameof(GeoClientOptions)).Bind(options);

        options.ApiKey.Should().Be("dev-auth-api-key");
    }

    #endregion

    #region GeoClientOptions — AllowedContextKeys (List<string>)

    /// <summary>
    /// Tests that <see cref="GeoClientOptions.AllowedContextKeys"/> binds from indexed config keys.
    /// </summary>
    [Fact]
    public void GeoClientOptions_AllowedContextKeys_BindsFromIndexedConfigKeys()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GeoClientOptions:AllowedContextKeys:0"] = "org_contact",
                ["GeoClientOptions:AllowedContextKeys:1"] = "user",
            })
            .Build();

        var options = new GeoClientOptions();
        config.GetSection(nameof(GeoClientOptions)).Bind(options);

        options.AllowedContextKeys.Should().BeEquivalentTo(["org_contact", "user"]);
    }

    /// <summary>
    /// Tests that when no AllowedContextKeys config is present, the list remains empty.
    /// </summary>
    [Fact]
    public void GeoClientOptions_AllowedContextKeys_DefaultsToEmptyWhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new GeoClientOptions();
        config.GetSection(nameof(GeoClientOptions)).Bind(options);

        options.AllowedContextKeys.Should().BeEmpty();
    }

    #endregion

    #region GeoClientOptions — Environment Variable Simulation

    /// <summary>
    /// Tests the full env var binding chain for <see cref="GeoClientOptions"/>
    /// including ApiKey and AllowedContextKeys.
    /// </summary>
    [Fact]
    public void GeoClientOptions_BindsAllPropertiesFromEnvironmentVariableFormat()
    {
        const string prefix = "D2TEST_CFGBIND2_";

        try
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoClientOptions__ApiKey", "dev-auth-api-key");
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoClientOptions__AllowedContextKeys__0", "org_contact");
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoClientOptions__AllowedContextKeys__1", "user");

            var config = new ConfigurationBuilder()
                .AddEnvironmentVariables(prefix)
                .Build();

            var options = new GeoClientOptions();
            config.GetSection(nameof(GeoClientOptions)).Bind(options);

            options.ApiKey.Should().Be("dev-auth-api-key");
            options.AllowedContextKeys.Should().BeEquivalentTo(["org_contact", "user"]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoClientOptions__ApiKey", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoClientOptions__AllowedContextKeys__0", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoClientOptions__AllowedContextKeys__1", null);
        }
    }

    #endregion

    #region Existing Properties Unaffected

    /// <summary>
    /// Tests that existing default properties on <see cref="GeoAppOptions"/> are not
    /// disturbed when binding only ApiKeyMappings.
    /// </summary>
    [Fact]
    public void GeoAppOptions_ExistingDefaults_PreservedWhenBindingApiKeyMappings()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GeoAppOptions:ApiKeyMappings:some-key:0"] = "ctx",
            })
            .Build();

        var options = new GeoAppOptions();
        config.GetSection(nameof(GeoAppOptions)).Bind(options);

        // Existing defaults should remain.
        options.LocationExpirationDuration.Should().Be(TimeSpan.FromHours(4));
        options.WhoIsExpirationDuration.Should().Be(TimeSpan.FromHours(4));
        options.ContactExpirationDuration.Should().Be(TimeSpan.FromHours(4));

        // New mapping should be present.
        options.ApiKeyMappings.Should().ContainKey("some-key");
    }

    /// <summary>
    /// Tests that existing default properties on <see cref="GeoClientOptions"/> are not
    /// disturbed when binding ApiKey and AllowedContextKeys.
    /// </summary>
    [Fact]
    public void GeoClientOptions_ExistingDefaults_PreservedWhenBindingNewProperties()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GeoClientOptions:ApiKey"] = "my-key",
                ["GeoClientOptions:AllowedContextKeys:0"] = "ctx",
            })
            .Build();

        var options = new GeoClientOptions();
        config.GetSection(nameof(GeoClientOptions)).Bind(options);

        // Existing defaults should remain.
        options.WhoIsCacheExpiration.Should().Be(TimeSpan.FromHours(8));
        options.WhoIsCacheMaxEntries.Should().Be(10_000);

        // New properties should be set.
        options.ApiKey.Should().Be("my-key");
        options.AllowedContextKeys.Should().BeEquivalentTo(["ctx"]);
    }

    #endregion

    #region Layered Config — Service Prefix Overlay

    /// <summary>
    /// Tests that service-specific overrides layer on top of shared defaults.
    /// Simulates: GeoClientOptions (shared) + AuthGeoClientOptions (service-specific).
    /// </summary>
    [Fact]
    public void GeoClientOptions_LayeredBinding_ServiceOverridesSharedDefaults()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                // Shared defaults.
                ["GeoClientOptions:WhoIsCacheMaxEntries"] = "20000",

                // Auth-specific overrides.
                ["AuthGeoClientOptions:ApiKey"] = "d2.auth.api.key",
                ["AuthGeoClientOptions:AllowedContextKeys:0"] = "org_contact",
            })
            .Build();

        var options = new GeoClientOptions();

        // Bind shared first, then overlay.
        config.GetSection(nameof(GeoClientOptions)).Bind(options);
        config.GetSection("AuthGeoClientOptions").Bind(options);

        // Shared value should be set.
        options.WhoIsCacheMaxEntries.Should().Be(20_000);

        // Service-specific overrides should be applied.
        options.ApiKey.Should().Be("d2.auth.api.key");
        options.AllowedContextKeys.Should().BeEquivalentTo(["org_contact"]);

        // Other shared defaults should be preserved.
        options.WhoIsCacheExpiration.Should().Be(TimeSpan.FromHours(8));
    }

    /// <summary>
    /// Tests that service-specific values override shared values for the same property.
    /// </summary>
    [Fact]
    public void GeoClientOptions_LayeredBinding_ServiceOverrideWinsOverShared()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                // Shared sets WhoIsCacheMaxEntries to 10000.
                ["GeoClientOptions:WhoIsCacheMaxEntries"] = "10000",

                // Service-specific overrides the same property.
                ["AuthGeoClientOptions:WhoIsCacheMaxEntries"] = "5000",
                ["AuthGeoClientOptions:ApiKey"] = "auth-key",
            })
            .Build();

        var options = new GeoClientOptions();
        config.GetSection(nameof(GeoClientOptions)).Bind(options);
        config.GetSection("AuthGeoClientOptions").Bind(options);

        // Service-specific override wins.
        options.WhoIsCacheMaxEntries.Should().Be(5_000);
        options.ApiKey.Should().Be("auth-key");
    }

    /// <summary>
    /// Tests that when no service prefix section exists, only shared defaults apply.
    /// </summary>
    [Fact]
    public void GeoClientOptions_LayeredBinding_NoOverrideSection_SharedDefaultsOnly()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GeoClientOptions:WhoIsCacheMaxEntries"] = "15000",
            })
            .Build();

        var options = new GeoClientOptions();
        config.GetSection(nameof(GeoClientOptions)).Bind(options);

        // Binding a non-existent section is a no-op.
        config.GetSection("AuthGeoClientOptions").Bind(options);

        options.WhoIsCacheMaxEntries.Should().Be(15_000);
        options.ApiKey.Should().Be(string.Empty);
        options.AllowedContextKeys.Should().BeEmpty();
    }

    /// <summary>
    /// Tests layered binding with environment variables, simulating D2Env output.
    /// </summary>
    [Fact]
    public void GeoClientOptions_LayeredBinding_WorksWithEnvironmentVariableFormat()
    {
        const string prefix = "D2TEST_LAYERED_";

        try
        {
            // Shared defaults.
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoClientOptions__WhoIsCacheMaxEntries", "12000");

            // Auth-specific overrides.
            Environment.SetEnvironmentVariable(
                $"{prefix}AuthGeoClientOptions__ApiKey", "d2.auth.api.key");
            Environment.SetEnvironmentVariable(
                $"{prefix}AuthGeoClientOptions__AllowedContextKeys__0", "org_contact");
            Environment.SetEnvironmentVariable(
                $"{prefix}AuthGeoClientOptions__AllowedContextKeys__1", "user");

            var config = new ConfigurationBuilder()
                .AddEnvironmentVariables(prefix)
                .Build();

            var options = new GeoClientOptions();
            config.GetSection(nameof(GeoClientOptions)).Bind(options);
            config.GetSection("AuthGeoClientOptions").Bind(options);

            options.WhoIsCacheMaxEntries.Should().Be(12_000);
            options.ApiKey.Should().Be("d2.auth.api.key");
            options.AllowedContextKeys.Should().BeEquivalentTo(["org_contact", "user"]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GeoClientOptions__WhoIsCacheMaxEntries", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}AuthGeoClientOptions__ApiKey", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}AuthGeoClientOptions__AllowedContextKeys__0", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}AuthGeoClientOptions__AllowedContextKeys__1", null);
        }
    }

    #endregion
}
