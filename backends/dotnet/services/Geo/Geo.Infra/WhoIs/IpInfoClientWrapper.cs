// -----------------------------------------------------------------------
// <copyright file="IpInfoClientWrapper.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.WhoIs;

using D2.Geo.App.Interfaces.WhoIs;
using IPinfo;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

/// <summary>
/// Implementation of <see cref="IIpInfoClient"/> wrapping the IPinfo.io SDK.
/// </summary>
public class IpInfoClientWrapper : IIpInfoClient
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
            r_logger.LogError(ex, "Failed to get IP details from IPinfo.io for {IpAddress}", ipAddress);
            return null;
        }
    }
}
