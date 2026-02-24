// -----------------------------------------------------------------------
// <copyright file="ISubs.ContactsEvicted.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Interfaces.Messaging.Handlers.Sub;

using D2.Events.Protos.V1;
using D2.Shared.Handler;

public partial interface ISubs
{
    /// <summary>
    /// Messaging subscription handler for contact eviction notifications.
    /// Evicts matching cache entries when contacts are deleted or replaced.
    /// </summary>
    public interface IContactsEvictedHandler : IHandler<ContactsEvictedEvent, ContactsEvictedOutput>;

    /// <summary>
    /// Output for contact eviction notification.
    /// </summary>
    public record ContactsEvictedOutput;
}
