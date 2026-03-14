// -----------------------------------------------------------------------
// <copyright file="SupportedLocales.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.I18n;

using D2.Shared.Utilities.Extensions;
using Microsoft.Extensions.Configuration;

/// <summary>
/// Defines the set of BCP 47 locales supported by the application and provides
/// helper methods for validation and resolution. Locales are read from the
/// <c>PUBLIC_ENABLED_LOCALES</c> indexed env-var section at startup.
/// All locales are stored in canonical BCP 47 casing (e.g. "en-US", "fr-CA").
/// </summary>
public static class SupportedLocales
{
    private static IReadOnlyList<string> s_all = ["en-US"];

    private static IReadOnlyDictionary<string, string> s_languageDefaults =
        new Dictionary<string, string> { ["en"] = "en-US" };

    /// <summary>
    /// Gets the base (default/fallback) locale. Configurable via <c>PUBLIC_DEFAULT_LOCALE</c> env var.
    /// </summary>
    public static string Base { get; private set; } = "en-US";

    /// <summary>
    /// Gets all supported locale codes in canonical BCP 47 casing.
    /// </summary>
    public static IReadOnlyList<string> All => s_all;

    /// <summary>
    /// Gets a map of each language prefix to the first locale for that language.
    /// For example, <c>"en" → "en-US"</c>, <c>"fr" → "fr-FR"</c>.
    /// </summary>
    public static IReadOnlyDictionary<string, string> LanguageDefaults => s_languageDefaults;

    /// <summary>
    /// Normalises any locale tag to canonical BCP 47 casing:
    /// lowercase language, uppercase region (e.g. "en-us" → "en-US", "FR-CA" → "fr-CA").
    /// Bare language codes are lowercased (e.g. "EN" → "en").
    /// </summary>
    /// <param name="tag">The locale tag to normalize.</param>
    /// <returns>The tag in canonical BCP 47 casing.</returns>
    public static string ToBcp47(string tag)
    {
        var dash = tag.IndexOf('-');
        return dash < 0
            ? tag.ToLowerInvariant()
            : tag[..dash].ToLowerInvariant() + tag[dash..].ToUpperInvariant();
    }

    /// <summary>
    /// Reads <c>PUBLIC_ENABLED_LOCALES</c> indexed section from configuration
    /// and initializes the supported locale list. Must be called once at startup
    /// before any locale resolution occurs.
    /// </summary>
    /// <param name="configuration">The application configuration.</param>
    public static void Configure(IConfiguration configuration)
    {
        var defaultLocale = configuration["PUBLIC_DEFAULT_LOCALE"];
        if (!defaultLocale.Falsey())
        {
            Base = ToBcp47(defaultLocale!.Trim());
        }

        var section = configuration.GetSection("PUBLIC_ENABLED_LOCALES");
        var values = section.GetChildren()
            .Select(c => c.Value)
            .Where(v => !v.Falsey())
            .Select(v => ToBcp47(v!.Trim()))
            .ToList();

        if (values.Count > 0)
        {
            s_all = values.AsReadOnly();
        }

        // Build language-prefix → first-locale map.
        var langDefaults = new Dictionary<string, string>();
        foreach (var locale in s_all)
        {
            var dashIndex = locale.IndexOf('-');
            var lang = dashIndex > 0 ? locale[..dashIndex] : locale;
            langDefaults.TryAdd(lang, locale);
        }

        s_languageDefaults = langDefaults;
    }

    /// <summary>
    /// Determines whether the given locale code is supported.
    /// Input is normalized to canonical BCP 47 casing before comparison.
    /// </summary>
    /// <param name="locale">The locale code to check.</param>
    /// <returns><see langword="true"/> if the locale is in the supported list; otherwise, <see langword="false"/>.</returns>
    public static bool IsValid(string locale) =>
        s_all.Contains(ToBcp47(locale));

    /// <summary>
    /// Resolves a locale code to its canonical BCP 47 form, falling back to
    /// <see cref="Base"/> when the input is <see langword="null"/> or unsupported.
    /// Performs canonical match, then language-family fallback.
    /// </summary>
    /// <param name="locale">The locale code to resolve, or <see langword="null"/>.</param>
    /// <returns>A supported locale code in canonical BCP 47 casing.</returns>
    public static string Resolve(string? locale)
    {
        if (locale.Falsey())
        {
            return Base;
        }

        var canonical = ToBcp47(locale!.Trim());

        if (s_all.Contains(canonical))
        {
            return canonical;
        }

        // Language-prefix fallback: "fr" → "fr-FR".
        var dash = canonical.IndexOf('-');
        var lang = dash > 0 ? canonical[..dash] : canonical;
        return s_languageDefaults.GetValueOrDefault(lang, Base);
    }
}
