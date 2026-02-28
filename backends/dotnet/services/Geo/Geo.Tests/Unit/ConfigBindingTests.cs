// -----------------------------------------------------------------------
// <copyright file="ConfigBindingTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit;

using D2.Geo.App;
using D2.Geo.Client;
using D2.Geo.Infra;
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
                ["GEO_APP:ApiKeyMappings:dev-auth-api-key:0"] = "org_contact",
                ["GEO_APP:ApiKeyMappings:dev-auth-api-key:1"] = "user",
            })
            .Build();

        var options = new GeoAppOptions();
        config.GetSection("GEO_APP").Bind(options);

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
                ["GEO_APP:ApiKeyMappings:auth-key:0"] = "org_contact",
                ["GEO_APP:ApiKeyMappings:auth-key:1"] = "user",
                ["GEO_APP:ApiKeyMappings:billing-key:0"] = "billing_contact",
            })
            .Build();

        var options = new GeoAppOptions();
        config.GetSection("GEO_APP").Bind(options);

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
        config.GetSection("GEO_APP").Bind(options);

        options.ApiKeyMappings.Should().BeEmpty();
    }

    #endregion

    #region GeoAppOptions — Environment Variable Simulation

    /// <summary>
    /// Tests that environment variable format keys (using __ as separator) bind correctly
    /// to <see cref="GeoAppOptions.ApiKeyMappings"/>. This simulates production env var binding.
    /// </summary>
    [Fact]
    public void GeoAppOptions_ApiKeyMappings_BindsFromEnvironmentVariableFormat()
    {
        // Env var: GEO_APP__APIKEYMAPPINGS__dev-auth-api-key__0=org_contact
        // .NET env var provider converts __ to : automatically.
        // AddEnvironmentVariables reads these and feeds them to IConfiguration.
        const string prefix = "D2TEST_CFGBIND_";

        try
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_APP__ApiKeyMappings__dev-auth-api-key__0", "org_contact");
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_APP__ApiKeyMappings__dev-auth-api-key__1", "user");

            var config = new ConfigurationBuilder()
                .AddEnvironmentVariables(prefix)
                .Build();

            var options = new GeoAppOptions();
            config.GetSection("GEO_APP").Bind(options);

            options.ApiKeyMappings.Should().ContainKey("dev-auth-api-key");
            options.ApiKeyMappings["dev-auth-api-key"]
                .Should().BeEquivalentTo(["org_contact", "user"]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_APP__ApiKeyMappings__dev-auth-api-key__0", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_APP__ApiKeyMappings__dev-auth-api-key__1", null);
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
                ["GEO_CLIENT:ApiKey"] = "dev-auth-api-key",
            })
            .Build();

        var options = new GeoClientOptions();
        config.GetSection("GEO_CLIENT").Bind(options);

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
                ["GEO_CLIENT:AllowedContextKeys:0"] = "org_contact",
                ["GEO_CLIENT:AllowedContextKeys:1"] = "user",
            })
            .Build();

        var options = new GeoClientOptions();
        config.GetSection("GEO_CLIENT").Bind(options);

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
        config.GetSection("GEO_CLIENT").Bind(options);

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
                $"{prefix}GEO_CLIENT__ApiKey", "dev-auth-api-key");
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_CLIENT__AllowedContextKeys__0", "org_contact");
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_CLIENT__AllowedContextKeys__1", "user");

            var config = new ConfigurationBuilder()
                .AddEnvironmentVariables(prefix)
                .Build();

            var options = new GeoClientOptions();
            config.GetSection("GEO_CLIENT").Bind(options);

            options.ApiKey.Should().Be("dev-auth-api-key");
            options.AllowedContextKeys.Should().BeEquivalentTo(["org_contact", "user"]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_CLIENT__ApiKey", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_CLIENT__AllowedContextKeys__0", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_CLIENT__AllowedContextKeys__1", null);
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
                ["GEO_APP:ApiKeyMappings:some-key:0"] = "ctx",
            })
            .Build();

        var options = new GeoAppOptions();
        config.GetSection("GEO_APP").Bind(options);

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
                ["GEO_CLIENT:ApiKey"] = "my-key",
                ["GEO_CLIENT:AllowedContextKeys:0"] = "ctx",
            })
            .Build();

        var options = new GeoClientOptions();
        config.GetSection("GEO_CLIENT").Bind(options);

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
    /// Simulates: GEO_CLIENT (shared) + AUTH_GEO_CLIENT (service-specific).
    /// </summary>
    [Fact]
    public void GeoClientOptions_LayeredBinding_ServiceOverridesSharedDefaults()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                // Shared defaults.
                ["GEO_CLIENT:WhoIsCacheMaxEntries"] = "20000",

                // Auth-specific overrides.
                ["AUTH_GEO_CLIENT:ApiKey"] = "d2.auth.api.key",
                ["AUTH_GEO_CLIENT:AllowedContextKeys:0"] = "org_contact",
            })
            .Build();

        var options = new GeoClientOptions();

        // Bind shared first, then overlay.
        config.GetSection("GEO_CLIENT").Bind(options);
        config.GetSection("AUTH_GEO_CLIENT").Bind(options);

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
                ["GEO_CLIENT:WhoIsCacheMaxEntries"] = "10000",

                // Service-specific overrides the same property.
                ["AUTH_GEO_CLIENT:WhoIsCacheMaxEntries"] = "5000",
                ["AUTH_GEO_CLIENT:ApiKey"] = "auth-key",
            })
            .Build();

        var options = new GeoClientOptions();
        config.GetSection("GEO_CLIENT").Bind(options);
        config.GetSection("AUTH_GEO_CLIENT").Bind(options);

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
                ["GEO_CLIENT:WhoIsCacheMaxEntries"] = "15000",
            })
            .Build();

        var options = new GeoClientOptions();
        config.GetSection("GEO_CLIENT").Bind(options);

        // Binding a non-existent section is a no-op.
        config.GetSection("AUTH_GEO_CLIENT").Bind(options);

        options.WhoIsCacheMaxEntries.Should().Be(15_000);
        options.ApiKey.Should().Be(string.Empty);
        options.AllowedContextKeys.Should().BeEmpty();
    }

    /// <summary>
    /// Tests layered binding with environment variables, simulating production env var format.
    /// </summary>
    [Fact]
    public void GeoClientOptions_LayeredBinding_WorksWithEnvironmentVariableFormat()
    {
        const string prefix = "D2TEST_LAYERED_";

        try
        {
            // Shared defaults.
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_CLIENT__WhoIsCacheMaxEntries", "12000");

            // Auth-specific overrides.
            Environment.SetEnvironmentVariable(
                $"{prefix}AUTH_GEO_CLIENT__ApiKey", "d2.auth.api.key");
            Environment.SetEnvironmentVariable(
                $"{prefix}AUTH_GEO_CLIENT__AllowedContextKeys__0", "org_contact");
            Environment.SetEnvironmentVariable(
                $"{prefix}AUTH_GEO_CLIENT__AllowedContextKeys__1", "user");

            var config = new ConfigurationBuilder()
                .AddEnvironmentVariables(prefix)
                .Build();

            var options = new GeoClientOptions();
            config.GetSection("GEO_CLIENT").Bind(options);
            config.GetSection("AUTH_GEO_CLIENT").Bind(options);

            options.WhoIsCacheMaxEntries.Should().Be(12_000);
            options.ApiKey.Should().Be("d2.auth.api.key");
            options.AllowedContextKeys.Should().BeEquivalentTo(["org_contact", "user"]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_CLIENT__WhoIsCacheMaxEntries", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}AUTH_GEO_CLIENT__ApiKey", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}AUTH_GEO_CLIENT__AllowedContextKeys__0", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}AUTH_GEO_CLIENT__AllowedContextKeys__1", null);
        }
    }

    #endregion

    #region GeoInfraOptions — RepoBatchSize (int)

    /// <summary>
    /// Tests that <see cref="GeoInfraOptions.RepoBatchSize"/> binds from a flat config key.
    /// </summary>
    [Fact]
    public void GeoInfraOptions_RepoBatchSize_BindsFromFlatConfigKey()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GEO_INFRA:RepoBatchSize"] = "1000",
            })
            .Build();

        var options = new GeoInfraOptions();
        config.GetSection("GEO_INFRA").Bind(options);

        options.RepoBatchSize.Should().Be(1000);
    }

    /// <summary>
    /// Tests that <see cref="GeoInfraOptions.RepoBatchSize"/> defaults to 500 when no config is present.
    /// </summary>
    [Fact]
    public void GeoInfraOptions_RepoBatchSize_DefaultsTo500WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new GeoInfraOptions();
        config.GetSection("GEO_INFRA").Bind(options);

        options.RepoBatchSize.Should().Be(500);
    }

    /// <summary>
    /// Tests that <see cref="GeoInfraOptions"/> binds from environment variable format.
    /// </summary>
    [Fact]
    public void GeoInfraOptions_BindsFromEnvironmentVariableFormat()
    {
        const string prefix = "D2TEST_INFRA_";

        try
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_INFRA__RepoBatchSize", "750");
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_INFRA__IpInfoAccessToken", "test-token");

            var config = new ConfigurationBuilder()
                .AddEnvironmentVariables(prefix)
                .Build();

            var options = new GeoInfraOptions();
            config.GetSection("GEO_INFRA").Bind(options);

            options.RepoBatchSize.Should().Be(750);
            options.IpInfoAccessToken.Should().Be("test-token");
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_INFRA__RepoBatchSize", null);
            Environment.SetEnvironmentVariable(
                $"{prefix}GEO_INFRA__IpInfoAccessToken", null);
        }
    }

    #endregion

    #region GeoAppOptions — WhoIsRetentionDays (int)

    /// <summary>
    /// Tests that <see cref="GeoAppOptions.WhoIsRetentionDays"/> binds from a flat config key.
    /// </summary>
    [Fact]
    public void GeoAppOptions_WhoIsRetentionDays_BindsFromFlatConfigKey()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GEO_APP:WhoIsRetentionDays"] = "90",
            })
            .Build();

        var options = new GeoAppOptions();
        config.GetSection("GEO_APP").Bind(options);

        options.WhoIsRetentionDays.Should().Be(90);
    }

    /// <summary>
    /// Tests that <see cref="GeoAppOptions.WhoIsRetentionDays"/> defaults to 180 when no config is present.
    /// </summary>
    [Fact]
    public void GeoAppOptions_WhoIsRetentionDays_DefaultsTo180WhenNoConfig()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var options = new GeoAppOptions();
        config.GetSection("GEO_APP").Bind(options);

        options.WhoIsRetentionDays.Should().Be(180);
    }

    #endregion
}
