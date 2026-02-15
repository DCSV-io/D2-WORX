// -----------------------------------------------------------------------
// <copyright file="D2EnvTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

// ReSharper disable StringLiteralTypo
// ReSharper disable CommentTypo
namespace D2.Shared.Tests.Unit;

using D2.Shared.Utilities.Configuration;
using FluentAssertions;
using JetBrains.Annotations;

/// <summary>
/// Unit tests for <see cref="D2Env"/>.
/// </summary>
/// <remarks>
/// <para>
/// Because <see cref="D2Env.Load"/> sets process-wide environment variables and has a
/// static <c>s_loaded</c> guard, these tests write a temporary <c>.env.local</c> file
/// into a known directory and invoke Load once via a shared fixture. Individual tests
/// then assert the expected environment variables were set correctly.
/// </para>
/// <para>
/// Cleanup of env vars and the temp file happens in the fixture's <c>DisposeAsync</c>
/// (after all tests in the class complete), not per-test, to avoid clearing state between tests.
/// </para>
/// </remarks>
public class D2EnvTests : IClassFixture<D2EnvTests.EnvFixture>
{
    /// <summary>
    /// Unique prefix to isolate test env vars from real ones.
    /// </summary>
    private const string _PREFIX = "D2ENVTEST";

    #region Infrastructure Transform Tests

    /// <summary>
    /// Tests that an infrastructure-style var produces the correct Parameters__kebab-case env var.
    /// </summary>
    [Fact]
    public void Load_InfraVar_ProducesParametersKebabCaseEnvVar()
    {
        Environment.GetEnvironmentVariable($"Parameters__{_PREFIX.ToLowerInvariant()}-dbusername")
            .Should().Be("postgres");
    }

    /// <summary>
    /// Tests that the cache password infrastructure transform is correct.
    /// </summary>
    [Fact]
    public void Load_CachePassword_ProducesParametersKebabCaseEnvVar()
    {
        Environment.GetEnvironmentVariable($"Parameters__{_PREFIX.ToLowerInvariant()}-cachepassword")
            .Should().Be("redis123");
    }

    #endregion

    #region Options Transform Tests

    /// <summary>
    /// Tests that a SECTION_PROPERTY var produces the correct Section__Property env var.
    /// </summary>
    [Fact]
    public void Load_OptionsVar_ProducesSectionDoubleUnderscorePropertyEnvVar()
    {
        Environment.GetEnvironmentVariable($"{_PREFIX}__DBUSERNAME")
            .Should().Be("postgres");
    }

    /// <summary>
    /// Tests that an options-style var with nested underscores splits on the first underscore only.
    /// </summary>
    [Fact]
    public void Load_NestedOptionsVar_SplitsOnFirstUnderscoreOnly()
    {
        // The key is D2ENVTEST_GEOINFRAOPTIONS_IPINFOACCESSTOKEN
        // Split on first _ → D2ENVTEST__GEOINFRAOPTIONS_IPINFOACCESSTOKEN
        Environment.GetEnvironmentVariable($"{_PREFIX}__GEOINFRAOPTIONS_IPINFOACCESSTOKEN")
            .Should().Be("tok_abc123");
    }

    /// <summary>
    /// Tests that a dictionary-style env var with double-underscore nesting preserves
    /// the inner <c>__</c> separators after the first-underscore split.
    /// This is the pattern used for <c>GeoAppOptions.ApiKeyMappings</c>.
    /// </summary>
    [Fact]
    public void Load_DictStyleVar_PreservesNestedDoubleUnderscores()
    {
        // The key is D2ENVTEST_APIKEYMAPPINGS__dev-auth-key__0
        // Split on first _ → D2ENVTEST__APIKEYMAPPINGS__dev-auth-key__0
        // .NET then interprets __ as : → D2ENVTEST:APIKEYMAPPINGS:dev-auth-key:0
        Environment.GetEnvironmentVariable($"{_PREFIX}__APIKEYMAPPINGS__dev-auth-key__0")
            .Should().Be("org_contact");
    }

    /// <summary>
    /// Tests the second indexed entry of the dictionary list value.
    /// </summary>
    [Fact]
    public void Load_DictStyleVar_SecondIndexBindsCorrectly()
    {
        Environment.GetEnvironmentVariable($"{_PREFIX}__APIKEYMAPPINGS__dev-auth-key__1")
            .Should().Be("user");
    }

    /// <summary>
    /// Tests a simple string property with double-underscore nesting (e.g., ApiKey).
    /// </summary>
    [Fact]
    public void Load_SimpleNestedVar_PreservesDoubleUnderscoreNesting()
    {
        // The key is D2ENVTEST_APIKEY
        // Split on first _ → D2ENVTEST__APIKEY
        Environment.GetEnvironmentVariable($"{_PREFIX}__APIKEY")
            .Should().Be("dev-auth-api-key");
    }

    /// <summary>
    /// Tests a list property with double-underscore indexed keys (e.g., AllowedContextKeys).
    /// </summary>
    [Fact]
    public void Load_ListStyleVar_PreservesIndexedDoubleUnderscores()
    {
        // The key is D2ENVTEST_ALLOWEDCONTEXTKEYS__0
        // Split on first _ → D2ENVTEST__ALLOWEDCONTEXTKEYS__0
        Environment.GetEnvironmentVariable($"{_PREFIX}__ALLOWEDCONTEXTKEYS__0")
            .Should().Be("org_contact");

        Environment.GetEnvironmentVariable($"{_PREFIX}__ALLOWEDCONTEXTKEYS__1")
            .Should().Be("user");
    }

    #endregion

    #region Original Key Tests

    /// <summary>
    /// Tests that the original env var name is preserved as-is.
    /// </summary>
    [Fact]
    public void Load_OriginalKey_IsPreserved()
    {
        Environment.GetEnvironmentVariable($"{_PREFIX}_DBUSERNAME")
            .Should().Be("postgres");
    }

    #endregion

    #region No Underscore Tests

    /// <summary>
    /// Tests that a var without underscores still gets the infrastructure transform but no options split.
    /// </summary>
    [Fact]
    public void Load_NoUnderscoreVar_GetsInfraTransformOnly()
    {
        // Original preserved.
        Environment.GetEnvironmentVariable("STANDALONE")
            .Should().Be("value");

        // Infrastructure transform applied.
        Environment.GetEnvironmentVariable("Parameters__standalone")
            .Should().Be("value");
    }

    #endregion

    #region SetIfAbsent Tests

    /// <summary>
    /// Tests that an existing environment variable is NOT overwritten by D2Env.
    /// </summary>
    [Fact]
    public void Load_ExistingEnvVar_IsNotOverwritten()
    {
        // The fixture pre-sets this before Load(). The .env file has "should_be_overwritten"
        // but SetIfAbsent should preserve the pre-existing value.
        Environment.GetEnvironmentVariable($"{_PREFIX}_PREEXISTING")
            .Should().Be("original_value");
    }

    #endregion

    /// <summary>
    /// Shared fixture that creates a temp .env.local file, invokes <see cref="D2Env.Load"/>,
    /// and cleans up after all tests complete.
    /// </summary>
    /// <remarks>
    /// Writes the file into <c>AppContext.BaseDirectory</c> where the private
    /// <c>FindEnvFile</c> method will discover it when walking up from the binary directory.
    /// </remarks>
    [MustDisposeResource(false)]
    public class EnvFixture : IAsyncLifetime
    {
        /// <summary>
        /// All env var keys this test suite touches, for cleanup.
        /// </summary>
        private static readonly string[] sr_allKeys =
        [
            $"{_PREFIX}_DBUSERNAME",
            $"{_PREFIX}_CACHEPASSWORD",
            $"{_PREFIX}_GEOINFRAOPTIONS_IPINFOACCESSTOKEN",
            "STANDALONE",
            $"{_PREFIX}_PREEXISTING",
            $"{_PREFIX}_APIKEYMAPPINGS__dev-auth-key__0",
            $"{_PREFIX}_APIKEYMAPPINGS__dev-auth-key__1",
            $"{_PREFIX}_APIKEY",
            $"{_PREFIX}_ALLOWEDCONTEXTKEYS__0",
            $"{_PREFIX}_ALLOWEDCONTEXTKEYS__1",
            $"Parameters__{_PREFIX.ToLowerInvariant()}-dbusername",
            $"Parameters__{_PREFIX.ToLowerInvariant()}-cachepassword",
            $"Parameters__{_PREFIX.ToLowerInvariant()}-geoinfraoptions-ipinfoaccesstoken",
            "Parameters__standalone",
            $"Parameters__{_PREFIX.ToLowerInvariant()}-preexisting",
            $"Parameters__{_PREFIX.ToLowerInvariant()}-apikeymappings--dev-auth-key--0",
            $"Parameters__{_PREFIX.ToLowerInvariant()}-apikeymappings--dev-auth-key--1",
            $"Parameters__{_PREFIX.ToLowerInvariant()}-apikey",
            $"Parameters__{_PREFIX.ToLowerInvariant()}-allowedcontextkeys--0",
            $"Parameters__{_PREFIX.ToLowerInvariant()}-allowedcontextkeys--1",
            $"{_PREFIX}__DBUSERNAME",
            $"{_PREFIX}__CACHEPASSWORD",
            $"{_PREFIX}__GEOINFRAOPTIONS_IPINFOACCESSTOKEN",
            $"{_PREFIX}__PREEXISTING",
            $"{_PREFIX}__APIKEYMAPPINGS__dev-auth-key__0",
            $"{_PREFIX}__APIKEYMAPPINGS__dev-auth-key__1",
            $"{_PREFIX}__APIKEY",
            $"{_PREFIX}__ALLOWEDCONTEXTKEYS__0",
            $"{_PREFIX}__ALLOWEDCONTEXTKEYS__1",
        ];

        private string _envFilePath = string.Empty;

        /// <summary>
        /// Sets up the test .env.local file and invokes <see cref="D2Env.Load"/>.
        /// </summary>
        /// <returns>A completed task.</returns>
        public ValueTask InitializeAsync()
        {
            // Place .env.local in the base directory where FindEnvFile will discover it.
            _envFilePath = Path.Combine(AppContext.BaseDirectory, ".env.local");

            // Pre-set an env var BEFORE Load() to test SetIfAbsent behavior.
            Environment.SetEnvironmentVariable($"{_PREFIX}_PREEXISTING", "original_value");

            var envContent =
                $"{_PREFIX}_DBUSERNAME=postgres\n" +
                $"{_PREFIX}_CACHEPASSWORD=redis123\n" +
                $"{_PREFIX}_GEOINFRAOPTIONS_IPINFOACCESSTOKEN=tok_abc123\n" +
                "STANDALONE=value\n" +
                $"{_PREFIX}_PREEXISTING=should_be_overwritten\n" +
                $"{_PREFIX}_APIKEYMAPPINGS__dev-auth-key__0=org_contact\n" +
                $"{_PREFIX}_APIKEYMAPPINGS__dev-auth-key__1=user\n" +
                $"{_PREFIX}_APIKEY=dev-auth-api-key\n" +
                $"{_PREFIX}_ALLOWEDCONTEXTKEYS__0=org_contact\n" +
                $"{_PREFIX}_ALLOWEDCONTEXTKEYS__1=user\n";

            File.WriteAllText(_envFilePath, envContent);

            // Reset the static guard so Load() runs fresh for these tests.
            var field = typeof(D2Env).GetField(
                "sv_loaded",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            field!.SetValue(null, false);

            D2Env.Load();

            return ValueTask.CompletedTask;
        }

        /// <summary>
        /// Cleans up environment variables and the temp .env.local file.
        /// </summary>
        /// <returns>A completed task.</returns>
        public ValueTask DisposeAsync()
        {
            foreach (var key in sr_allKeys)
            {
                Environment.SetEnvironmentVariable(key, null);
            }

            if (File.Exists(_envFilePath))
            {
                File.Delete(_envFilePath);
            }

            return ValueTask.CompletedTask;
        }
    }
}
