// -----------------------------------------------------------------------
// <copyright file="IComplex.FindWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Interfaces.CQRS.Handlers.X;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Utilities.Attributes;
using D2.Shared.Utilities.Enums;

public partial interface IComplex
{
    /// <summary>
    /// Handler for finding WhoIs data by IP address and user agent.
    /// </summary>
    /// <remarks>
    /// This is a Complex handler because it may fetch from external source (gRPC)
    /// and cache the result locally.
    /// </remarks>
    public interface IFindWhoIsHandler : IHandler<FindWhoIsInput, FindWhoIsOutput>;

    /// <summary>
    /// Input for finding WhoIs data.
    /// </summary>
    ///
    /// <param name="IpAddress">
    /// The IP address to look up.
    /// </param>
    /// <param name="UserAgent">
    /// The user agent string used as fingerprint.
    /// </param>
    public record FindWhoIsInput(
        [property: RedactData(Reason = RedactReason.PersonalInformation)] string IpAddress,
        [property: RedactData(Reason = RedactReason.PersonalInformation)] string UserAgent);

    /// <summary>
    /// Output for finding WhoIs data.
    /// </summary>
    ///
    /// <param name="WhoIs">
    /// The WhoIs data if found; otherwise, null.
    /// </param>
    public record FindWhoIsOutput(WhoIsDTO? WhoIs);
}
