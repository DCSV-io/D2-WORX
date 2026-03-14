// -----------------------------------------------------------------------
// <copyright file="ITranslator.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.I18n;

/// <summary>
/// Provides translation lookup for message keys across supported locales.
/// </summary>
public interface ITranslator
{
    /// <summary>
    /// Translates a message key for the specified locale, with optional parameter interpolation.
    /// Falls back to the base locale if the key is not found in the requested locale,
    /// and returns the raw key if no translation exists at all.
    /// </summary>
    /// <param name="locale">The locale code (e.g. "en", "es").</param>
    /// <param name="key">The translation key (e.g. "common_errors_NOT_FOUND").</param>
    /// <param name="parameters">
    /// Optional dictionary of named parameters to interpolate. Occurrences of
    /// <c>{paramName}</c> in the translated string are replaced with the corresponding value.
    /// </param>
    /// <returns>The translated and interpolated string, or the raw key if no translation is found.</returns>
    string T(string locale, string key, Dictionary<string, string>? parameters = null);

    /// <summary>
    /// Determines whether a translation key exists in any loaded locale catalog.
    /// </summary>
    /// <param name="key">The translation key to check.</param>
    /// <returns><see langword="true"/> if the key exists in at least one locale; otherwise, <see langword="false"/>.</returns>
    bool HasKey(string key);
}
