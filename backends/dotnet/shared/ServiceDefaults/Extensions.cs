// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.ServiceDefaults;

using System.Net;

/// <summary>
/// Provides extension methods for setting up default services and middleware in a .NET application.
/// </summary>
public static partial class Extensions
{
    private const string _HEALTH_ENDPOINT_PATH = "/health";
    private const string _ALIVE_ENDPOINT_PATH = "/alive";
    private const string _METRICS_ENDPOINT_PATH = "/metrics";

    /// <summary>
    /// Determines if the given IP address is allowed to access the metrics endpoint.
    /// </summary>
    ///
    /// <param name="remoteIp">
    /// The remote IP address to check.
    /// </param>
    ///
    /// <returns>
    /// True if the IP address is allowed; otherwise, false.
    /// </returns>
    private static bool IsAllowedIpForMetrics(IPAddress? remoteIp)
    {
        if (remoteIp == null)
        {
            return false;
        }

        // Check localhost
        if (IPAddress.IsLoopback(remoteIp))
        {
            return true;
        }

        // Check RFC 1918 private address ranges.
        // Covers Docker bridge, Kubernetes pod networks, and other private deployments.
        var bytes = remoteIp.GetAddressBytes();
        if (bytes.Length == 4)
        {
            // 10.0.0.0/8
            if (bytes[0] == 10)
            {
                return true;
            }

            // 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
            if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
            {
                return true;
            }

            // 192.168.0.0/16
            if (bytes[0] == 192 && bytes[1] == 168)
            {
                return true;
            }
        }

        return false;
    }
}
