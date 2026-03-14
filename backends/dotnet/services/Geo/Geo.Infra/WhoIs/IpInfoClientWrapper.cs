// -----------------------------------------------------------------------
// <copyright file="IpInfoClientWrapper.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.WhoIs;

using D2.Geo.App.Interfaces.WhoIs;
using D2.Shared.Utilities.Extensions;
using IPinfo;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

/// <summary>
/// Implementation of <see cref="IIpInfoClient"/> wrapping the IPinfo.io SDK.
/// </summary>
public partial class IpInfoClientWrapper : IIpInfoClient
{
    private readonly IPinfoClient r_client;
    private readonly ILogger<IpInfoClientWrapper> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="IpInfoClientWrapper"/> class.
    /// </summary>
    ///
    /// <param name="options">
    /// The Geo infrastructure options containing the API token.
    /// </param>
    /// <param name="logger">
    /// The logger.
    /// </param>
    public IpInfoClientWrapper(
        IOptions<GeoInfraOptions> options,
        ILogger<IpInfoClientWrapper> logger)
    {
        if (options.Value.IpInfoAccessToken.Falsey())
        {
            LogIpInfoTokenNotConfigured(logger);
        }

        r_client = new IPinfoClient.Builder()
            .AccessToken(options.Value.IpInfoAccessToken)
            .Build();
        r_logger = logger;
    }

    /// <inheritdoc/>
    public async Task<IpInfoResponse?> GetDetailsAsync(string ipAddress, CancellationToken ct = default)
    {
        try
        {
            var response = await r_client.IPApi.GetDetailsAsync(ipAddress, ct);

            return new IpInfoResponse
            {
                Ip = response.IP,
                Hostname = response.Hostname,
                City = response.City,
                Region = response.Region,
                Country = response.Country,
                Postal = response.Postal,
                Latitude = response.Latitude,
                Longitude = response.Longitude,
                Org = response.Org,
                Privacy = response.Privacy is not null
                    ? new IpInfoPrivacy
                    {
                        Vpn = response.Privacy.Vpn,
                        Proxy = response.Privacy.Proxy,
                        Tor = response.Privacy.Tor,
                        Relay = response.Privacy.Relay,
                        Hosting = response.Privacy.Hosting,
                    }
                    : null,
            };
        }
        catch (Exception ex)
        {
            // Do not log raw ipAddress — it is PII.
            LogGetIpDetailsFailed(r_logger, ex);
            return null;
        }
    }

    /// <summary>
    /// Logs a critical message when the IpInfo access token is not configured.
    /// </summary>
    [LoggerMessage(EventId = 1, Level = LogLevel.Critical, Message = "IpInfoAccessToken is not configured — IPinfo requests will use unauthenticated (rate-limited) access. Set GeoInfraOptions:IpInfoAccessToken via configuration or environment variables for production use.")]
    private static partial void LogIpInfoTokenNotConfigured(ILogger logger);

    /// <summary>
    /// Logs an error when fetching IP details from IPinfo.io fails.
    /// </summary>
    [LoggerMessage(EventId = 2, Level = LogLevel.Error, Message = "Failed to get IP details from IPinfo.io")]
    private static partial void LogGetIpDetailsFailed(ILogger logger, Exception exception);
}
