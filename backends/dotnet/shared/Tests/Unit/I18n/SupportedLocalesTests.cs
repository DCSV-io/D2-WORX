// -----------------------------------------------------------------------
// <copyright file="SupportedLocalesTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.I18n;

using D2.Shared.I18n;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.Extensions.Configuration;

/// <summary>
/// Unit tests for the <see cref="SupportedLocales"/> static class.
/// </summary>
[Collection("I18n")]
[MustDisposeResource(false)]
public class SupportedLocalesTests : IDisposable
{
    /// <summary>
    /// Initializes a new instance of the <see cref="SupportedLocalesTests"/> class.
    /// Configures <see cref="SupportedLocales"/> with 10 BCP 47 locales
    /// matching the <c>PUBLIC_ENABLED_LOCALES</c> indexed env var convention.
    /// </summary>
    [MustDisposeResource(false)]
    public SupportedLocalesTests()
    {
        ConfigureWithAllLocales();
    }

    #region IsValid

    /// <summary>
    /// Tests that IsValid returns true for all supported BCP 47 locale tags.
    /// </summary>
    /// <param name="locale">A supported BCP 47 locale tag.</param>
    [Theory]
    [InlineData("en-us")]
    [InlineData("en-ca")]
    [InlineData("en-gb")]
    [InlineData("fr-fr")]
    [InlineData("fr-ca")]
    [InlineData("es-es")]
    [InlineData("es-mx")]
    [InlineData("de-de")]
    [InlineData("it-it")]
    [InlineData("ja-jp")]
    public void IsValid_WithValidLocale_ReturnsTrue(string locale)
    {
        // Act
        var result = SupportedLocales.IsValid(locale);

        // Assert
        result.Should().BeTrue();
    }

    /// <summary>
    /// Tests that IsValid returns false for unsupported locale codes.
    /// </summary>
    /// <param name="locale">An unsupported locale code.</param>
    [Theory]
    [InlineData("zh")]
    [InlineData("pt-BR")]
    [InlineData("xx")]
    [InlineData("")]
    [InlineData("en")]
    [InlineData("fr")]
    public void IsValid_WithInvalidLocale_ReturnsFalse(string locale)
    {
        // Act
        var result = SupportedLocales.IsValid(locale);

        // Assert
        result.Should().BeFalse();
    }

    /// <summary>
    /// Tests that IsValid is case-insensitive (normalises to canonical BCP 47 casing internally).
    /// </summary>
    /// <param name="locale">A mixed-case BCP 47 locale tag.</param>
    [Theory]
    [InlineData("EN-US")]
    [InlineData("Fr-Ca")]
    [InlineData("ja-JP")]
    public void IsValid_WithMixedCase_ReturnsTrue(string locale)
    {
        // Act
        var result = SupportedLocales.IsValid(locale);

        // Assert
        result.Should().BeTrue();
    }

    #endregion

    #region Resolve

    /// <summary>
    /// Tests that Resolve returns the same locale in canonical BCP 47 casing when it is supported.
    /// </summary>
    [Fact]
    public void Resolve_WithValidLocale_ReturnsSameLocale()
    {
        // Act
        var result = SupportedLocales.Resolve("fr-FR");

        // Assert
        result.Should().Be("fr-FR");
    }

    /// <summary>
    /// Tests that Resolve returns the base locale when input is null.
    /// </summary>
    [Fact]
    public void Resolve_WithNull_ReturnsBase()
    {
        // Act
        var result = SupportedLocales.Resolve(null);

        // Assert
        result.Should().Be("en-US");
    }

    /// <summary>
    /// Tests that Resolve returns the base locale when the input is unsupported.
    /// </summary>
    [Fact]
    public void Resolve_WithUnsupportedLocale_ReturnsBase()
    {
        // Act
        var result = SupportedLocales.Resolve("zh-CN");

        // Assert
        result.Should().Be("en-US");
    }

    /// <summary>
    /// Tests that Resolve performs language-family fallback for bare language codes.
    /// </summary>
    /// <param name="input">The bare language code.</param>
    /// <param name="expected">The expected resolved BCP 47 locale.</param>
    [Theory]
    [InlineData("en", "en-US")]
    [InlineData("fr", "fr-FR")]
    [InlineData("es", "es-ES")]
    [InlineData("de", "de-DE")]
    [InlineData("it", "it-IT")]
    [InlineData("ja", "ja-JP")]
    public void Resolve_WithBareLanguageCode_FallsBackToLanguageDefault(string input, string expected)
    {
        // Act
        var result = SupportedLocales.Resolve(input);

        // Assert
        result.Should().Be(expected);
    }

    /// <summary>
    /// Tests that Resolve falls back to the language default for unknown regions.
    /// </summary>
    /// <param name="input">An unsupported regional variant.</param>
    /// <param name="expected">The expected language-family default.</param>
    [Theory]
    [InlineData("en-AU", "en-US")]
    [InlineData("fr-CH", "fr-FR")]
    [InlineData("es-AR", "es-ES")]
    public void Resolve_WithUnknownRegion_FallsBackToLanguageDefault(string input, string expected)
    {
        // Act
        var result = SupportedLocales.Resolve(input);

        // Assert
        result.Should().Be(expected);
    }

    /// <summary>
    /// Tests that Resolve normalises mixed-case input to canonical BCP 47 casing.
    /// </summary>
    /// <param name="input">The mixed-case locale input.</param>
    /// <param name="expected">The expected canonical BCP 47 result.</param>
    [Theory]
    [InlineData("EN-US", "en-US")]
    [InlineData("Fr-Ca", "fr-CA")]
    [InlineData("JA-JP", "ja-JP")]
    public void Resolve_WithMixedCase_NormalisesToCanonical(string input, string expected)
    {
        // Act
        var result = SupportedLocales.Resolve(input);

        // Assert
        result.Should().Be(expected);
    }

    /// <summary>
    /// Tests that Resolve trims whitespace.
    /// </summary>
    [Fact]
    public void Resolve_WithWhitespace_TrimsAndResolves()
    {
        // Act
        var result = SupportedLocales.Resolve("  fr-CA  ");

        // Assert
        result.Should().Be("fr-CA");
    }

    /// <summary>
    /// Tests that Resolve returns the base locale for empty input.
    /// </summary>
    [Fact]
    public void Resolve_WithEmpty_ReturnsBase()
    {
        // Act
        var result = SupportedLocales.Resolve(string.Empty);

        // Assert
        result.Should().Be("en-US");
    }

    #endregion

    #region Constants

    /// <summary>
    /// Tests that BASE is "en-US".
    /// </summary>
    [Fact]
    public void BASE_IsEnUS()
    {
        SupportedLocales.Base.Should().Be("en-US");
    }

    /// <summary>
    /// Tests that BASE can be overridden via PUBLIC_DEFAULT_LOCALE config.
    /// </summary>
    [Fact]
    public void BASE_CanBeOverriddenViaConfig()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PUBLIC_DEFAULT_LOCALE"] = "fr-FR",
                ["PUBLIC_ENABLED_LOCALES:0"] = "en-US",
                ["PUBLIC_ENABLED_LOCALES:1"] = "fr-FR",
            })
            .Build();

        // Act
        SupportedLocales.Configure(config);

        // Assert
        SupportedLocales.Base.Should().Be("fr-FR");

        // Cleanup — restore defaults for other tests
        ConfigureWithAllLocales();
    }

    /// <summary>
    /// Tests that All contains exactly the expected 10 BCP 47 locales.
    /// </summary>
    [Fact]
    public void All_ContainsExpectedLocales()
    {
        SupportedLocales.All.Should().BeEquivalentTo(
            ["en-US", "en-CA", "en-GB", "fr-FR", "fr-CA", "es-ES", "es-MX", "de-DE", "it-IT", "ja-JP"]);
    }

    #endregion

    #region LanguageDefaults

    /// <summary>
    /// Tests that LanguageDefaults maps each language prefix to its first locale.
    /// </summary>
    [Fact]
    public void LanguageDefaults_MapsLanguagePrefixToFirstLocale()
    {
        // Assert — first locale per language wins (order from env var)
        SupportedLocales.LanguageDefaults.Should().ContainKey("en").WhoseValue.Should().Be("en-US");
        SupportedLocales.LanguageDefaults.Should().ContainKey("fr").WhoseValue.Should().Be("fr-FR");
        SupportedLocales.LanguageDefaults.Should().ContainKey("es").WhoseValue.Should().Be("es-ES");
        SupportedLocales.LanguageDefaults.Should().ContainKey("de").WhoseValue.Should().Be("de-DE");
        SupportedLocales.LanguageDefaults.Should().ContainKey("it").WhoseValue.Should().Be("it-IT");
        SupportedLocales.LanguageDefaults.Should().ContainKey("ja").WhoseValue.Should().Be("ja-JP");
    }

    /// <summary>
    /// Tests that LanguageDefaults contains exactly 6 entries (one per language family).
    /// </summary>
    [Fact]
    public void LanguageDefaults_HasCorrectCount()
    {
        SupportedLocales.LanguageDefaults.Should().HaveCount(6);
    }

    #endregion

    #region Helpers

    /// <inheritdoc/>
    public void Dispose()
    {
        // Reset to default state so other test classes are unaffected.
        ConfigureWithAllLocales();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Configures <see cref="SupportedLocales"/> with all 10 BCP 47 locales.
    /// </summary>
    private static void ConfigureWithAllLocales()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PUBLIC_DEFAULT_LOCALE"] = "en-US",
                ["PUBLIC_ENABLED_LOCALES:0"] = "en-US",
                ["PUBLIC_ENABLED_LOCALES:1"] = "en-CA",
                ["PUBLIC_ENABLED_LOCALES:2"] = "en-GB",
                ["PUBLIC_ENABLED_LOCALES:3"] = "fr-FR",
                ["PUBLIC_ENABLED_LOCALES:4"] = "fr-CA",
                ["PUBLIC_ENABLED_LOCALES:5"] = "es-ES",
                ["PUBLIC_ENABLED_LOCALES:6"] = "es-MX",
                ["PUBLIC_ENABLED_LOCALES:7"] = "de-DE",
                ["PUBLIC_ENABLED_LOCALES:8"] = "it-IT",
                ["PUBLIC_ENABLED_LOCALES:9"] = "ja-JP",
            })
            .Build();
        SupportedLocales.Configure(config);
    }

    #endregion
}
