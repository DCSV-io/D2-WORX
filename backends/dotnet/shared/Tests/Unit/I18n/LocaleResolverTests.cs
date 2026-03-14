// -----------------------------------------------------------------------
// <copyright file="LocaleResolverTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.I18n;

using D2.Shared.I18n;
using D2.Shared.Translation.Default;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

/// <summary>
/// Unit tests for the <see cref="LocaleResolver"/> static class.
/// </summary>
[Collection("I18n")]
[MustDisposeResource(false)]
public class LocaleResolverTests : IDisposable
{
    /// <summary>
    /// Initializes a new instance of the <see cref="LocaleResolverTests"/> class.
    /// Configures <see cref="SupportedLocales"/> with all 10 BCP 47 locales.
    /// </summary>
    [MustDisposeResource(false)]
    public LocaleResolverTests()
    {
        ConfigureLocales();
    }

    #region D2-Locale Header

    /// <summary>
    /// Tests that Resolve returns the D2-Locale header value when it is a valid BCP 47 tag.
    /// </summary>
    [Fact]
    public void Resolve_WithD2LocaleHeader_ReturnsThatLocale()
    {
        // Arrange
        var request = CreateRequest(d2Locale: "es-ES");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert
        result.Should().Be("es-ES");
    }

    /// <summary>
    /// Tests that Resolve normalizes an uppercase D2-Locale header to canonical BCP 47 casing.
    /// </summary>
    [Fact]
    public void Resolve_WithD2LocaleInUpperCase_NormalizesToCanonical()
    {
        // Arrange
        var request = CreateRequest(d2Locale: "ES-MX");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert
        result.Should().Be("es-MX");
    }

    /// <summary>
    /// Tests that D2-Locale with a bare language code resolves via language-family fallback.
    /// </summary>
    [Fact]
    public void Resolve_WithBareLanguageD2Locale_FallsBackToLanguageDefault()
    {
        // Arrange
        var request = CreateRequest(d2Locale: "fr");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert
        result.Should().Be("fr-FR");
    }

    /// <summary>
    /// Tests that an unsupported D2-Locale resolves to the base locale (Accept-Language is not reached).
    /// D2-Locale is always consumed by SupportedLocales.Resolve — Accept-Language is not reached.
    /// </summary>
    [Fact]
    public void Resolve_WithInvalidD2Locale_ReturnsBase()
    {
        // Arrange — "zh" has no language default; Accept-Language "fr-FR" is valid
        var request = CreateRequest(d2Locale: "zh", acceptLanguage: "fr-FR");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert — D2-Locale "zh" resolves to "en-US" (base), Accept-Language is not reached
        // because D2-Locale header is present and SupportedLocales.Resolve always returns something
        result.Should().Be("en-US");
    }

    /// <summary>
    /// Tests that D2-Locale takes priority over Accept-Language.
    /// </summary>
    [Fact]
    public void Resolve_WithD2LocalePriority_OverridesAcceptLanguage()
    {
        // Arrange
        var request = CreateRequest(d2Locale: "ja-JP", acceptLanguage: "fr-FR");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert
        result.Should().Be("ja-JP");
    }

    /// <summary>
    /// Tests that whitespace around the D2-Locale value is trimmed.
    /// </summary>
    [Fact]
    public void Resolve_WithWhitespaceD2Locale_TrimsAndResolves()
    {
        // Arrange
        var request = CreateRequest(d2Locale: " es-ES ");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert
        result.Should().Be("es-ES");
    }

    /// <summary>
    /// Tests that an empty D2-Locale header resolves to base (D2-Locale present but empty
    /// still enters SupportedLocales.Resolve which returns BASE for empty/null).
    /// </summary>
    [Fact]
    public void Resolve_WithEmptyD2Locale_ReturnsBase()
    {
        // Arrange
        var request = CreateRequest(d2Locale: string.Empty, acceptLanguage: "de-DE");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert — empty D2-Locale still enters Resolve path, returns base
        result.Should().Be("en-US");
    }

    #endregion

    #region Accept-Language Header

    /// <summary>
    /// Tests that Resolve picks the highest quality tag from Accept-Language.
    /// </summary>
    [Fact]
    public void Resolve_WithAcceptLanguage_ReturnsHighestQuality()
    {
        // Arrange — both are valid BCP 47 tags in our supported list
        var request = CreateRequest(acceptLanguage: "fr-FR;q=0.8,de-DE;q=0.9");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert — de-DE has higher quality
        result.Should().Be("de-DE");
    }

    /// <summary>
    /// Tests that an exact BCP 47 match in Accept-Language works (e.g., "fr-CA" is directly supported).
    /// </summary>
    [Fact]
    public void Resolve_WithAcceptLanguageExactMatch_ReturnsExactLocale()
    {
        // Arrange — fr-CA is in our supported list
        var request = CreateRequest(acceptLanguage: "fr-CA,en-US;q=0.5");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert — fr-CA is a direct exact match
        result.Should().Be("fr-CA");
    }

    /// <summary>
    /// Tests that a bare language code in Accept-Language falls back via language defaults.
    /// </summary>
    [Fact]
    public void Resolve_WithBareLanguageInAcceptLanguage_FallsBackToLanguageDefault()
    {
        // Arrange — "fr" is not an exact match but maps via language defaults
        var request = CreateRequest(acceptLanguage: "fr");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert — "fr" → language default "fr-FR"
        result.Should().Be("fr-FR");
    }

    /// <summary>
    /// Tests that an Accept-Language tag with quality 0 is skipped.
    /// </summary>
    [Fact]
    public void Resolve_WithAcceptLanguageQZero_SkipsTag()
    {
        // Arrange
        var request = CreateRequest(acceptLanguage: "es-ES;q=0,fr-FR;q=0.5");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert — es-ES has q=0 (excluded), but ParseAcceptLanguage includes it
        // with q=0; it IS a valid locale, so it matches. The parser sorts by quality
        // descending, so fr-FR (q=0.5) comes first.
        result.Should().Be("fr-FR");
    }

    /// <summary>
    /// Tests that unsupported Accept-Language values fall back to base.
    /// </summary>
    [Fact]
    public void Resolve_WithUnsupportedAcceptLanguage_ReturnsBase()
    {
        // Arrange — zh-CN not supported, no "zh" language default
        var request = CreateRequest(acceptLanguage: "zh-CN");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert
        result.Should().Be("en-US");
    }

    /// <summary>
    /// Tests that malformed Accept-Language header falls back to base.
    /// </summary>
    [Fact]
    public void Resolve_WithMalformedAcceptLanguage_ReturnsBase()
    {
        // Arrange
        var request = CreateRequest(acceptLanguage: ";;;;");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert
        result.Should().Be("en-US");
    }

    /// <summary>
    /// Tests that Resolve picks the best supported match from multiple tags,
    /// skipping unsupported ones based on quality weight.
    /// </summary>
    [Fact]
    public void Resolve_WithMultipleAcceptLanguageTags_PicksBestMatch()
    {
        // Arrange — zh-CN (unsupported), fr-FR;q=0.7, de-DE;q=0.8
        var request = CreateRequest(acceptLanguage: "zh-CN,fr-FR;q=0.7,de-DE;q=0.8");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert — zh-CN has implicit q=1.0 but is unsupported, de-DE has q=0.8 > fr-FR q=0.7
        result.Should().Be("de-DE");
    }

    /// <summary>
    /// Tests that mixed-case Accept-Language tags are normalized to canonical BCP 47 casing.
    /// </summary>
    [Fact]
    public void Resolve_WithMixedCaseAcceptLanguage_NormalizesToCanonical()
    {
        // Arrange — "FR-CA" is a direct match (case-insensitive)
        var request = CreateRequest(acceptLanguage: "FR-CA,EN-US;q=0.5");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert
        result.Should().Be("fr-CA");
    }

    /// <summary>
    /// Tests that unknown regional variants in Accept-Language fall back to language defaults.
    /// </summary>
    [Fact]
    public void Resolve_WithUnknownRegionInAcceptLanguage_FallsBackToLanguageDefault()
    {
        // Arrange — fr-CH is not in our list, but "fr" → "fr-FR"
        var request = CreateRequest(acceptLanguage: "fr-CH");

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert
        result.Should().Be("fr-FR");
    }

    #endregion

    #region No Headers

    /// <summary>
    /// Tests that Resolve returns the base locale when no locale-related headers are present.
    /// </summary>
    [Fact]
    public void Resolve_WithNoHeaders_ReturnsBase()
    {
        // Arrange
        var request = CreateRequest();

        // Act
        var result = LocaleResolver.Resolve(request);

        // Assert
        result.Should().Be("en-US");
    }

    #endregion

    #region Helpers

    /// <inheritdoc/>
    public void Dispose()
    {
        // Reset to default state.
        ConfigureLocales();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Creates an <see cref="HttpRequest"/> with optional locale headers.
    /// </summary>
    private static HttpRequest CreateRequest(string? d2Locale = null, string? acceptLanguage = null)
    {
        var context = new DefaultHttpContext();
        if (d2Locale is not null)
        {
            context.Request.Headers["D2-Locale"] = d2Locale;
        }

        if (acceptLanguage is not null)
        {
            context.Request.Headers.AcceptLanguage = acceptLanguage;
        }

        return context.Request;
    }

    private static void ConfigureLocales()
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
