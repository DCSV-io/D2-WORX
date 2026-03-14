// -----------------------------------------------------------------------
// <copyright file="TranslatorTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.I18n;

using D2.Shared.I18n;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.Extensions.Configuration;

/// <summary>
/// Unit tests for the <see cref="Translator"/> class.
/// </summary>
[Collection("I18n")]
[MustDisposeResource(false)]
public class TranslatorTests : IDisposable
{
    private static readonly string sr_messagesDir = Path.Combine(AppContext.BaseDirectory, "messages");

    /// <summary>
    /// Initializes a new instance of the <see cref="TranslatorTests"/> class.
    /// Configures <see cref="SupportedLocales"/> so <see cref="Translator.T"/>
    /// can resolve BCP 47 locale tags correctly.
    /// </summary>
    [MustDisposeResource(false)]
    public TranslatorTests()
    {
        ConfigureLocales();
    }

    #region T — Known Key

    /// <summary>
    /// Tests that translating a known key for the "en-US" locale returns the correct English text.
    /// </summary>
    [Fact]
    public void T_WithKnownKey_ReturnsTranslatedText()
    {
        // Arrange
        var translator = new Translator(sr_messagesDir);

        // Act
        var result = translator.T("en-US", "common_errors_NOT_FOUND");

        // Assert
        result.Should().Be("The requested resource was not found.");
    }

    /// <summary>
    /// Tests that translating with a bare language code resolves via language-family fallback.
    /// </summary>
    [Fact]
    public void T_WithBareLanguageCode_ResolvesToLanguageDefault()
    {
        // Arrange
        var translator = new Translator(sr_messagesDir);

        // Act — "en" resolves to "en-US" via language default
        var result = translator.T("en", "common_errors_NOT_FOUND");

        // Assert — should return the en-US translation
        result.Should().Be("The requested resource was not found.");
    }

    #endregion

    #region T — Unknown Key

    /// <summary>
    /// Tests that translating an unknown key returns the key itself.
    /// </summary>
    [Fact]
    public void T_WithUnknownKey_ReturnsKeyItself()
    {
        // Arrange
        var translator = new Translator(sr_messagesDir);

        // Act
        var result = translator.T("en-US", "nonexistent_key");

        // Assert
        result.Should().Be("nonexistent_key");
    }

    #endregion

    #region T — Fallback to Base Locale

    /// <summary>
    /// Tests that translating a key in both en-US and es-ES returns non-key translations,
    /// verifying the catalog is properly loaded for multiple locales.
    /// </summary>
    [Fact]
    public void T_WithFallbackToBaseLocale_ReturnsBaseTranslation()
    {
        // Arrange
        var translator = new Translator(sr_messagesDir);

        // Act
        var enResult = translator.T("en-US", "common_errors_NOT_FOUND");
        var esResult = translator.T("es-ES", "common_errors_NOT_FOUND");

        // Assert — both should produce a non-key translation (either locale-specific or base fallback)
        enResult.Should().NotBe("common_errors_NOT_FOUND");
        esResult.Should().NotBe("common_errors_NOT_FOUND");
    }

    #endregion

    #region T — Parameter Interpolation

    /// <summary>
    /// Tests that parameter placeholders in translation strings are replaced with provided values.
    /// </summary>
    [Fact]
    public void T_WithParameters_InterpolatesValues()
    {
        // Arrange
        var translator = new Translator(sr_messagesDir);
        var parameters = new Dictionary<string, string> { { "name", "Alice" } };

        // Act — use a key known to have {name} placeholder
        var result = translator.T("en-US", "auth_email_verification_greeting", parameters);

        // Assert
        result.Should().Be("Hi Alice,");
    }

    /// <summary>
    /// Tests that unmatched parameter placeholders are left as-is in the output.
    /// </summary>
    [Fact]
    public void T_WithUnmatchedParameter_LeavesPlaceholder()
    {
        // Arrange
        var translator = new Translator(sr_messagesDir);
        var parameters = new Dictionary<string, string> { { "wrong", "value" } };

        // Act — the template has {name} but we provide {wrong}
        var result = translator.T("en-US", "auth_email_verification_greeting", parameters);

        // Assert
        result.Should().Contain("{name}");
    }

    #endregion

    #region HasKey

    /// <summary>
    /// Tests that HasKey returns true for a key that exists in the loaded catalogs.
    /// </summary>
    [Fact]
    public void HasKey_WithExistingKey_ReturnsTrue()
    {
        // Arrange
        var translator = new Translator(sr_messagesDir);

        // Act
        var result = translator.HasKey("common_errors_NOT_FOUND");

        // Assert
        result.Should().BeTrue();
    }

    /// <summary>
    /// Tests that HasKey returns false for a key that does not exist.
    /// </summary>
    [Fact]
    public void HasKey_WithNonExistingKey_ReturnsFalse()
    {
        // Arrange
        var translator = new Translator(sr_messagesDir);

        // Act
        var result = translator.HasKey("this_key_does_not_exist_anywhere");

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region Constructor Validation

    /// <summary>
    /// Tests that the constructor throws <see cref="DirectoryNotFoundException"/>
    /// when the specified directory does not exist.
    /// </summary>
    [Fact]
    public void Constructor_WithInvalidDirectory_ThrowsDirectoryNotFound()
    {
        // Arrange
        const string invalid_path = "/non/existent/directory/that/does/not/exist";

        // Act
        var act = () => new Translator(invalid_path);

        // Assert
        act.Should().Throw<DirectoryNotFoundException>();
    }

    /// <summary>
    /// Tests that the constructor throws <see cref="ArgumentException"/>
    /// when the path is null.
    /// </summary>
    [Fact]
    public void Constructor_WithNullPath_ThrowsArgumentException()
    {
        // Act
        var act = () => new Translator(null!);

        // Assert
        act.Should().Throw<ArgumentException>();
    }

    /// <summary>
    /// Tests that the constructor throws <see cref="ArgumentException"/>
    /// when the path is empty.
    /// </summary>
    [Fact]
    public void Constructor_WithEmptyPath_ThrowsArgumentException()
    {
        // Act
        var act = () => new Translator(string.Empty);

        // Assert
        act.Should().Throw<ArgumentException>();
    }

    /// <summary>
    /// Tests that the constructor throws <see cref="ArgumentException"/>
    /// when the path is whitespace.
    /// </summary>
    [Fact]
    public void Constructor_WithWhitespacePath_ThrowsArgumentException()
    {
        // Act
        var act = () => new Translator("   ");

        // Assert
        act.Should().Throw<ArgumentException>();
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
