// -----------------------------------------------------------------------
// <copyright file="IRead.GetWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.WhoIs.Handlers.R;

using D2.Contracts.Handler;

public partial interface IRead
{
    /// <summary>
    /// Handler for getting WhoIs information based on IP addresses and optional fingerprints.
    /// </summary>
    public interface IGetWhoIsHandler : IHandler<GetWhoIsInput, GetWhoIsOutput>;

    /// <summary>
    /// Input for getting WhoIs information.
    /// </summary>
    ///
    /// <param name="Requests">
    /// A list of tuples, each containing an IP address and an optional fingerprint.
    /// </param>
    public record GetWhoIsInput(List<(string IPAddress, string? Fingerprint)> Requests);

    /// <summary>
    /// Output for getting WhoIs information.
    /// </summary>
    ///
    /// <param name="Data">
    /// A dictionary mapping tuples of IP addresses and optional fingerprints to their
    /// corresponding WhoIs entities.
    /// </param>
    public record GetWhoIsOutput(
        Dictionary<(string IPAddress, string? Fingerprint), Domain.Entities.WhoIs> Data);
}
