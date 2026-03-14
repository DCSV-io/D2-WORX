// -----------------------------------------------------------------------
// <copyright file="TranslationMiddlewareTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.I18n;

using System.Text.Json;
using D2.Shared.I18n;
using D2.Shared.Translation.Default;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Moq;

/// <summary>
/// Unit tests for the <see cref="TranslationMiddleware"/> class.
/// </summary>
[Collection("I18n")]
[MustDisposeResource(false)]
public class TranslationMiddlewareTests : IDisposable
{
    /// <summary>
    /// Initializes a new instance of the <see cref="TranslationMiddlewareTests"/> class.
    /// Configures <see cref="SupportedLocales"/> with all 10 BCP 47 locales.
    /// </summary>
    [MustDisposeResource(false)]
    public TranslationMiddlewareTests()
    {
        ConfigureLocales();
    }

    #region Message Translation

    /// <summary>
    /// Tests that known translation keys in the messages array are translated.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous unit test.</returns>
    [Fact]
    public async Task InvokeAsync_WithD2ResultMessages_TranslatesKnownKeys()
    {
        // Arrange
        var responseJson = """{"statusCode":200,"messages":["common_errors_NOT_FOUND"]}""";

        // Act
        var result = await InvokeMiddleware(responseJson);

        // Assert — no D2-Locale header → Resolve returns "en-US" (BASE),
        // then SupportedLocales.Resolve("en-US") → "en-US"
        var doc = JsonDocument.Parse(result);
        var messages = doc.RootElement.GetProperty("messages");
        messages.GetArrayLength().Should().Be(1);
        messages[0].GetString().Should().Be("[en-US:common_errors_NOT_FOUND]");
    }

    /// <summary>
    /// Tests that input error messages are translated while field names are preserved.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous unit test.</returns>
    [Fact]
    public async Task InvokeAsync_WithD2ResultInputErrors_TranslatesErrorKeys()
    {
        // Arrange
        var responseJson = """{"statusCode":400,"inputErrors":[["email","geo_validation_email_required"]]}""";

        // Act
        var result = await InvokeMiddleware(responseJson);

        // Assert
        var doc = JsonDocument.Parse(result);
        var inputErrors = doc.RootElement.GetProperty("inputErrors");
        inputErrors.GetArrayLength().Should().Be(1);

        var errorGroup = inputErrors[0];
        errorGroup[0].GetString().Should().Be("email", "field name should be preserved");
        errorGroup[1].GetString().Should().Be("[en-US:geo_validation_email_required]");
    }

    /// <summary>
    /// Tests that only known keys are translated; unknown literal strings pass through.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous unit test.</returns>
    [Fact]
    public async Task InvokeAsync_WithMixedKnownAndUnknownKeys_TranslatesOnlyKnown()
    {
        // Arrange
        var responseJson = """{"statusCode":200,"messages":["common_errors_NOT_FOUND","some literal message"]}""";

        // Act
        var result = await InvokeMiddleware(responseJson);

        // Assert
        var doc = JsonDocument.Parse(result);
        var messages = doc.RootElement.GetProperty("messages");
        messages[0].GetString().Should().Be("[en-US:common_errors_NOT_FOUND]");
        messages[1].GetString().Should().Be("some literal message");
    }

    #endregion

    #region Pass-Through Scenarios

    /// <summary>
    /// Tests that a JSON response without a statusCode property passes through unchanged.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous unit test.</returns>
    [Fact]
    public async Task InvokeAsync_WithNonD2Result_PassesThroughUnchanged()
    {
        // Arrange
        var responseJson = """{"data":"hello","messages":["common_errors_NOT_FOUND"]}""";

        // Act
        var result = await InvokeMiddleware(responseJson);

        // Assert — should pass through unchanged (no statusCode = not a D2Result)
        var doc = JsonDocument.Parse(result);
        doc.RootElement.GetProperty("data").GetString().Should().Be("hello");
        doc.RootElement.GetProperty("messages")[0].GetString().Should().Be("common_errors_NOT_FOUND");
    }

    /// <summary>
    /// Tests that a text/plain response passes through without modification.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous unit test.</returns>
    [Fact]
    public async Task InvokeAsync_WithNonJsonResponse_PassesThroughUnchanged()
    {
        // Arrange
        const string response_text = "plain text body";

        // Act
        var result = await InvokeMiddleware(response_text, contentType: "text/plain");

        // Assert
        result.Should().Be(response_text);
    }

    /// <summary>
    /// Tests that a D2Result with an empty messages array passes through without error.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous unit test.</returns>
    [Fact]
    public async Task InvokeAsync_WithEmptyMessagesArray_PassesThroughUnchanged()
    {
        // Arrange
        var responseJson = """{"statusCode":200,"messages":[]}""";

        // Act
        var result = await InvokeMiddleware(responseJson);

        // Assert
        var doc = JsonDocument.Parse(result);
        doc.RootElement.GetProperty("messages").GetArrayLength().Should().Be(0);
    }

    /// <summary>
    /// Tests that an empty response body passes through without error.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous unit test.</returns>
    [Fact]
    public async Task InvokeAsync_WithEmptyBody_PassesThroughUnchanged()
    {
        // Arrange / Act
        var result = await InvokeMiddleware(string.Empty);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region Content-Type Preservation

    /// <summary>
    /// Tests that the response Content-Type is preserved as application/json after translation.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous unit test.</returns>
    [Fact]
    public async Task InvokeAsync_PreservesContentType()
    {
        // Arrange
        var responseJson = """{"statusCode":200,"messages":["common_errors_NOT_FOUND"]}""";
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        var middleware = new TranslationMiddleware(async ctx =>
        {
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(responseJson);
        });

        // Act
        await middleware.InvokeAsync(context, CreateMockTranslator());

        // Assert
        context.Response.ContentType.Should().Contain("application/json");
    }

    #endregion

    #region Locale Resolution

    /// <summary>
    /// Tests that the translator is called with the locale from the D2-Locale header.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous unit test.</returns>
    [Fact]
    public async Task InvokeAsync_WithD2LocaleHeader_UsesCorrectLocale()
    {
        // Arrange
        var responseJson = """{"statusCode":200,"messages":["common_errors_NOT_FOUND"]}""";

        // Act — D2-Locale "fr-FR" → SupportedLocales.Resolve → "fr-FR"
        var result = await InvokeMiddleware(responseJson, d2Locale: "fr-FR");

        // Assert — the mock translator encodes locale in output: [fr-FR:key]
        var doc = JsonDocument.Parse(result);
        doc.RootElement.GetProperty("messages")[0].GetString().Should().Be("[fr-FR:common_errors_NOT_FOUND]");
    }

    #endregion

    #region Data Preservation

    /// <summary>
    /// Tests that other D2Result fields (like data) are preserved through translation.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous unit test.</returns>
    [Fact]
    public async Task InvokeAsync_PreservesOtherD2ResultFields()
    {
        // Arrange
        var responseJson = """{"statusCode":200,"data":{"id":1},"messages":["common_errors_NOT_FOUND"]}""";

        // Act
        var result = await InvokeMiddleware(responseJson);

        // Assert
        var doc = JsonDocument.Parse(result);
        doc.RootElement.GetProperty("statusCode").GetInt64().Should().Be(200);
        doc.RootElement.GetProperty("data").GetProperty("id").GetInt64().Should().Be(1);
        doc.RootElement.GetProperty("messages")[0].GetString().Should().Be("[en-US:common_errors_NOT_FOUND]");
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
    /// Creates a mock <see cref="ITranslator"/> that recognizes keys starting with
    /// "common_errors_" or "geo_validation_" and returns "[locale:key]" as the translation.
    /// </summary>
    private static ITranslator CreateMockTranslator()
    {
        var mock = new Mock<ITranslator>();
        mock.Setup(t => t.HasKey(It.IsAny<string>()))
            .Returns<string>(key => key.StartsWith("common_errors_", StringComparison.Ordinal) ||
                                    key.StartsWith("geo_validation_", StringComparison.Ordinal));
        mock.Setup(t => t.T(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>?>()))
            .Returns<string, string, Dictionary<string, string>?>((locale, key, _) => $"[{locale}:{key}]");
        return mock.Object;
    }

    /// <summary>
    /// Invokes the <see cref="TranslationMiddleware"/> with a simulated response.
    /// </summary>
    /// <param name="responseJson">The response body the inner middleware will write.</param>
    /// <param name="contentType">The Content-Type for the response (default: application/json).</param>
    /// <param name="d2Locale">Optional D2-Locale header value to set on the request.</param>
    /// <param name="translator">Optional translator to use (defaults to mock).</param>
    /// <returns>The final response body as a string.</returns>
    private static async Task<string> InvokeMiddleware(
        string responseJson,
        string contentType = "application/json",
        string? d2Locale = null,
        ITranslator? translator = null)
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        if (d2Locale is not null)
        {
            context.Request.Headers["D2-Locale"] = d2Locale;
        }

        var middleware = new TranslationMiddleware(async ctx =>
        {
            ctx.Response.ContentType = contentType;
            if (responseJson.Length > 0)
            {
                await ctx.Response.WriteAsync(responseJson);
            }
        });

        await middleware.InvokeAsync(context, translator ?? CreateMockTranslator());

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        return await reader.ReadToEndAsync();
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
