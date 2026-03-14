// -----------------------------------------------------------------------
// <copyright file="LocaleResolver.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Translation.Default;

using D2.Shared.I18n;
using Microsoft.AspNetCore.Http;

/// <summary>
/// Resolves the request locale from headers.
/// Priority: D2-Locale header → Accept-Language → BASE locale fallback.
/// </summary>
public static class LocaleResolver
{
    /// <summary>
    /// Resolves the locale for the given HTTP request by examining headers
    /// in priority order: <c>D2-Locale</c> (explicit preference from SvelteKit),
    /// <c>Accept-Language</c> (browser default), then the base locale fallback.
    /// </summary>
    /// <param name="request">The HTTP request to resolve the locale from.</param>
    /// <returns>A supported locale code.</returns>
    public static string Resolve(HttpRequest request)
    {
        // 1. D2-Locale header — delegate to SupportedLocales.Resolve().
        if (request.Headers.TryGetValue("D2-Locale", out var d2Locale))
        {
            return SupportedLocales.Resolve(d2Locale.ToString());
        }

        // 2. Accept-Language: try each tag, exact match first.
        var acceptLanguage = request.Headers.AcceptLanguage.FirstOrDefault();
        if (acceptLanguage is not null)
        {
            foreach (var tag in ParseAcceptLanguage(acceptLanguage))
            {
                if (SupportedLocales.IsValid(tag))
                {
                    return SupportedLocales.ToBcp47(tag);
                }
            }

            // No exact match — try language-family defaults.
            foreach (var tag in ParseAcceptLanguage(acceptLanguage))
            {
                var dash = tag.IndexOf('-');
                var lang = dash > 0 ? tag[..dash] : tag;
                if (SupportedLocales.LanguageDefaults.TryGetValue(lang, out var def))
                {
                    return def;
                }
            }
        }

        return SupportedLocales.Resolve(null);
    }

    /// <summary>
    /// Parses an Accept-Language header value into locale tags sorted by
    /// quality weight descending. For example, <c>"fr-CA,fr;q=0.9,en;q=0.8"</c>
    /// yields <c>["fr-ca", "fr", "en"]</c>.
    /// </summary>
    /// <param name="header">The raw Accept-Language header value.</param>
    /// <returns>Locale tags in descending quality order.</returns>
    private static IEnumerable<string> ParseAcceptLanguage(string header)
    {
        return header.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part =>
            {
                var parts = part.Split(';', 2);
                var tag = parts[0].Trim().ToLowerInvariant();
                var quality = 1.0;
                if (parts.Length > 1)
                {
                    var qPart = parts[1].Trim();
                    if (qPart.StartsWith("q=", StringComparison.OrdinalIgnoreCase) &&
                        double.TryParse(
                            qPart[2..],
                            System.Globalization.NumberStyles.Float,
                            System.Globalization.CultureInfo.InvariantCulture,
                            out var q))
                    {
                        quality = q;
                    }
                }

                return (tag, quality);
            })
            .OrderByDescending(x => x.quality)
            .Select(x => x.tag);
    }
}
