// -----------------------------------------------------------------------
// <copyright file="IpResolver.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment.Default;

using Microsoft.AspNetCore.Http;

/// <summary>
/// Static helper for resolving the client IP address from HTTP request headers.
/// </summary>
public static class IpResolver
{
    /// <summary>
    /// Cloudflare header containing the original client IP.
    /// </summary>
    private const string _CF_CONNECTING_IP = "CF-Connecting-IP";

    /// <summary>
    /// Nginx/reverse proxy header containing the real IP.
    /// </summary>
    private const string _X_REAL_IP = "X-Real-IP";

    /// <summary>
    /// Standard proxy header containing forwarded IPs (first entry = original client).
    /// </summary>
    private const string _X_FORWARDED_FOR = "X-Forwarded-For";

    /// <summary>
    /// Resolves the client IP address from the HTTP context.
    /// Only proxy headers listed in <paramref name="trustedHeaders"/> are checked.
    /// </summary>
    ///
    /// <param name="context">
    /// The HTTP context to resolve the IP from.
    /// </param>
    /// <param name="trustedHeaders">
    /// The set of proxy headers to trust. If null, defaults to Cloudflare only.
    /// </param>
    /// <param name="maxHeaderLength">
    /// Maximum allowed length for header values. Values exceeding this are truncated. Defaults to 2048.
    /// </param>
    ///
    /// <returns>
    /// The resolved client IP address, or "unknown" if it cannot be determined.
    /// </returns>
    /// <remarks>
    /// Priority chain (when trusted):
    /// 1. CF-Connecting-IP (Cloudflare — trusted, single IP)
    /// 2. X-Real-IP (Nginx/reverse proxy)
    /// 3. X-Forwarded-For (first entry = original client)
    /// 4. HttpContext.Connection.RemoteIpAddress (direct connection fallback).
    /// </remarks>
    public static string Resolve(HttpContext context, HashSet<TrustedProxyHeader>? trustedHeaders = null, int maxHeaderLength = 2048)
    {
        trustedHeaders ??= [TrustedProxyHeader.CfConnectingIp];

        // 1. Cloudflare header — most trusted if present.
        if (trustedHeaders.Contains(TrustedProxyHeader.CfConnectingIp) &&
            context.Request.Headers.TryGetValue(_CF_CONNECTING_IP, out var cfIp))
        {
            var ip = cfIp.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(ip))
            {
                return Truncate(ip.Trim(), maxHeaderLength);
            }
        }

        // 2. X-Real-IP — Nginx/reverse proxy.
        if (trustedHeaders.Contains(TrustedProxyHeader.XRealIp) &&
            context.Request.Headers.TryGetValue(_X_REAL_IP, out var realIp))
        {
            var ip = realIp.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(ip))
            {
                return Truncate(ip.Trim(), maxHeaderLength);
            }
        }

        // 3. X-Forwarded-For — first entry is the original client.
        if (trustedHeaders.Contains(TrustedProxyHeader.XForwardedFor) &&
            context.Request.Headers.TryGetValue(_X_FORWARDED_FOR, out var forwardedFor))
        {
            var forwardedValue = forwardedFor.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(forwardedValue))
            {
                // Truncate before parsing to prevent abuse from oversized headers.
                var truncated = Truncate(forwardedValue, maxHeaderLength);

                // Format can be "client, proxy1, proxy2" — take the first one.
                var firstIp = truncated.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(firstIp))
                {
                    return firstIp.Trim();
                }
            }
        }

        // 4. Direct connection fallback.
        var remoteIp = context.Connection.RemoteIpAddress;
        if (remoteIp is not null)
        {
            // Handle IPv4-mapped IPv6 addresses (::ffff:192.168.1.1).
            if (remoteIp.IsIPv4MappedToIPv6)
            {
                return remoteIp.MapToIPv4().ToString();
            }

            return remoteIp.ToString();
        }

        return "unknown";
    }

    /// <summary>
    /// Determines whether the IP address is a localhost/loopback address.
    /// </summary>
    ///
    /// <param name="ip">
    /// The IP address string to check.
    /// </param>
    ///
    /// <returns>
    /// True if the IP is localhost or loopback; otherwise, false.
    /// </returns>
    public static bool IsLocalhost(string ip)
    {
        return ip is "127.0.0.1" or "::1" or "localhost" or "unknown";
    }

    private static string Truncate(string value, int maxLength)
    {
        return value.Length > maxLength ? value[..maxLength] : value;
    }
}
