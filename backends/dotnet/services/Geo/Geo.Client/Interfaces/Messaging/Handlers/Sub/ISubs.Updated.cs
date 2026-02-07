// -----------------------------------------------------------------------
// <copyright file="ISubs.Updated.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Interfaces.Messaging.Handlers.Sub;

using D2.Geo.Client.Messages;
using D2.Shared.Handler;

public partial interface ISubs
{
    /// <summary>
    /// Messaging subscription handler for geographic reference data updated notifications.
    /// </summary>
    public interface IUpdatedHandler : IHandler<GeoRefDataUpdated, UpdatedOutput>;

    /// <summary>
    /// Output for geographic reference data updated notification.
    /// </summary>
    public record UpdatedOutput;
}
