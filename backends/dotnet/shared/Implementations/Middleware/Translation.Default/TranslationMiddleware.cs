// -----------------------------------------------------------------------
// <copyright file="TranslationMiddleware.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Translation.Default;

using System.Text.Json;
using D2.Shared.I18n;
using D2.Shared.RequestEnrichment.Default;
using Microsoft.AspNetCore.Http;

/// <summary>
/// Middleware that intercepts JSON responses containing D2Result objects and
/// translates message keys and input error keys to localized text using
/// <see cref="ITranslator"/>. The locale is resolved from request headers
/// via <see cref="LocaleResolver"/>.
/// </summary>
/// <remarks>
/// <para>
/// D2Result shape detection: any JSON response with a top-level <c>statusCode</c>
/// property is treated as a D2Result.
/// </para>
/// <para>
/// Translation targets:
/// <list type="bullet">
///   <item><c>messages[]</c> — each string entry is translated if it matches a known key.</item>
///   <item><c>inputErrors[]</c> — each sub-array is <c>[fieldName, error1, error2, ...]</c>.
///     Index 0 (field name) is preserved; index 1+ entries are translated if they match known keys.</item>
/// </list>
/// </para>
/// <para>Must run AFTER <c>UseIdempotency()</c> so it wraps all endpoint responses.</para>
/// </remarks>
public class TranslationMiddleware
{
    private readonly RequestDelegate r_next;

    /// <summary>
    /// Initializes a new instance of the <see cref="TranslationMiddleware"/> class.
    /// </summary>
    /// <param name="next">The next middleware in the pipeline.</param>
    public TranslationMiddleware(RequestDelegate next)
    {
        r_next = next;
    }

    /// <summary>
    /// Buffers the response, detects D2Result JSON, and translates message keys
    /// and input error keys to localized text.
    /// </summary>
    /// <param name="context">The HTTP context.</param>
    /// <param name="translator">The translator service for locale-aware message lookup.</param>
    /// <returns>A task representing the asynchronous operation.</returns>
    public async Task InvokeAsync(HttpContext context, ITranslator translator)
    {
        if (InfrastructurePaths.IsInfrastructure(context))
        {
            await r_next(context);
            return;
        }

        // Buffer the response.
        var originalBody = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;

        await r_next(context);

        buffer.Seek(0, SeekOrigin.Begin);

        if (IsJsonResponse(context) && buffer.Length > 0)
        {
            try
            {
                var locale = LocaleResolver.Resolve(context.Request);
                using var doc = await JsonDocument.ParseAsync(buffer);
                var root = doc.RootElement;

                // Only translate if it looks like a D2Result (has statusCode).
                if (root.TryGetProperty("statusCode", out _))
                {
                    var translated = TranslateD2Result(root, locale, translator);
                    context.Response.Body = originalBody;
                    context.Response.ContentLength = null;
                    await context.Response.WriteAsJsonAsync(translated);
                    return;
                }
            }
            catch (JsonException)
            {
                // Not valid JSON — pass through.
            }
        }

        // Non-D2Result or non-JSON — pass through.
        buffer.Seek(0, SeekOrigin.Begin);
        context.Response.Body = originalBody;
        await buffer.CopyToAsync(originalBody);
    }

    /// <summary>
    /// Determines whether the response has a JSON content type.
    /// </summary>
    private static bool IsJsonResponse(HttpContext context)
    {
        var contentType = context.Response.ContentType;
        return contentType is not null &&
               contentType.Contains("application/json", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Builds a mutable dictionary representation of the D2Result, translating
    /// <c>messages</c> and <c>inputErrors</c> entries that match known translation keys.
    /// </summary>
    private static object TranslateD2Result(JsonElement root, string locale, ITranslator translator)
    {
        var result = new Dictionary<string, object?>();

        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name == "messages" && prop.Value.ValueKind == JsonValueKind.Array)
            {
                // Translate message strings that are translation keys.
                var messages = new List<string>();
                foreach (var msg in prop.Value.EnumerateArray())
                {
                    var text = msg.GetString() ?? string.Empty;
                    messages.Add(translator.HasKey(text) ? translator.T(locale, text) : text);
                }

                result[prop.Name] = messages;
            }
            else if (prop.Name == "inputErrors" && prop.Value.ValueKind == JsonValueKind.Array)
            {
                // Translate input error messages (skip field name at index 0).
                var inputErrors = new List<List<string>>();
                foreach (var errorGroup in prop.Value.EnumerateArray())
                {
                    if (errorGroup.ValueKind != JsonValueKind.Array)
                    {
                        continue;
                    }

                    var group = new List<string>();
                    var i = 0;
                    foreach (var item in errorGroup.EnumerateArray())
                    {
                        var text = item.GetString() ?? string.Empty;

                        // Index 0 = field name, rest = error messages.
                        group.Add(i > 0 && translator.HasKey(text) ? translator.T(locale, text) : text);
                        i++;
                    }

                    inputErrors.Add(group);
                }

                result[prop.Name] = inputErrors;
            }
            else
            {
                // Pass through other fields as-is.
                result[prop.Name] = JsonElementToObject(prop.Value);
            }
        }

        return result;
    }

    /// <summary>
    /// Recursively converts a <see cref="JsonElement"/> to a CLR object suitable
    /// for JSON serialization via <c>WriteAsJsonAsync</c>.
    /// </summary>
    private static object? JsonElementToObject(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => element.EnumerateObject()
                .ToDictionary(p => p.Name, p => JsonElementToObject(p.Value)),
            JsonValueKind.Array => element.EnumerateArray()
                .Select(JsonElementToObject).ToList(),
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null,
        };
    }
}
