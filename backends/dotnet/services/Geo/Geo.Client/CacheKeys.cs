// -----------------------------------------------------------------------
// <copyright file="CacheKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client;

using System.Security.Cryptography;
using System.Text;

/// <summary>
/// Centralized cache key definitions for the Geo client library.
/// </summary>
public static class CacheKeys
{
    /// <summary>
    /// GeoRefData blob key (in-memory + distributed cache).
    /// </summary>
    public const string REFDATA = "geo:refdata";

    /// <summary>
    /// Prefix for contacts-by-ext-key cache entries.
    /// </summary>
    public const string CONTACTS_BY_EXT_KEY_PREFIX = "geo:contacts-by-extkey";

    /// <summary>
    /// Generates a cache key for a single contact by ID.
    /// </summary>
    /// <param name="id">The contact ID.</param>
    /// <returns>Cache key in format <c>geo:contact:{id}</c>.</returns>
    public static string Contact(Guid id) => $"geo:contact:{id}";

    /// <summary>
    /// Generates a cache key for contacts by external key pair.
    /// </summary>
    /// <param name="contextKey">The context key.</param>
    /// <param name="relatedEntityId">The related entity ID.</param>
    /// <returns>Cache key in format <c>geo:contacts-by-extkey:{contextKey}:{relatedEntityId}</c>.</returns>
    public static string ContactsByExtKey(string contextKey, Guid relatedEntityId) =>
        $"{CONTACTS_BY_EXT_KEY_PREFIX}:{contextKey}:{relatedEntityId}";

    /// <summary>
    /// Generates a cache key for WhoIs lookup by IP and user agent.
    /// The user agent is hashed to SHA-256 to keep cache keys compact
    /// (raw UA strings can exceed 500 characters).
    /// </summary>
    /// <param name="ip">The IP address.</param>
    /// <param name="userAgent">The user agent string (hashed internally to a 64-char fingerprint).</param>
    /// <returns>Cache key in format <c>geo:whois:{ip}:{fingerprint}</c>.</returns>
    public static string WhoIs(string ip, string userAgent)
    {
        var fingerprint = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(userAgent)));
        return $"geo:whois:{ip}:{fingerprint}";
    }
}
