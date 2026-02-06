// -----------------------------------------------------------------------
// <copyright file="FingerprintBuilder.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment;

using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;

/// <summary>
/// Static helper for building server-side fingerprints from request headers.
/// </summary>
public static class FingerprintBuilder
{
    /// <summary>
    /// Builds a server-side fingerprint from request headers.
    /// </summary>
    ///
    /// <param name="context">
    /// The HTTP context to build the fingerprint from.
    /// </param>
    ///
    /// <returns>
    /// A 64-character lowercase hex string (SHA-256 hash).
    /// </returns>
    /// <remarks>
    /// The fingerprint is computed from:
    /// SHA-256(User-Agent + "|" + Accept-Language + "|" + Accept-Encoding + "|" + Accept)
    /// This is for logging/analytics only, NOT for rate limiting.
    /// </remarks>
    public static string Build(HttpContext context)
    {
        var headers = context.Request.Headers;

        var userAgent = headers.UserAgent.FirstOrDefault() ?? string.Empty;
        var acceptLanguage = headers.AcceptLanguage.FirstOrDefault() ?? string.Empty;
        var acceptEncoding = headers.AcceptEncoding.FirstOrDefault() ?? string.Empty;
        var accept = headers.Accept.FirstOrDefault() ?? string.Empty;

        var input = $"{userAgent}|{acceptLanguage}|{acceptEncoding}|{accept}";

        return ComputeSha256Hash(input);
    }

    /// <summary>
    /// Computes a SHA-256 hash of the input string.
    /// </summary>
    ///
    /// <param name="input">
    /// The string to hash.
    /// </param>
    ///
    /// <returns>
    /// A 64-character lowercase hex string.
    /// </returns>
    private static string ComputeSha256Hash(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexStringLower(hash);
    }
}
