// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.ServiceDefaults;

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

        // Check Docker networks (172.17-20.0.0/16)
        var bytes = remoteIp.GetAddressBytes();
        if (bytes.Length == 4 &&
            bytes[0] == 172 &&
            bytes[1] >= 17 &&
            bytes[1] <= 20)
        {
            return true;
        }

        return false;
    }
}
