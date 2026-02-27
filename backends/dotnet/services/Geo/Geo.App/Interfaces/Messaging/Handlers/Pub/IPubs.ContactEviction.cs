// -----------------------------------------------------------------------
// <copyright file="IPubs.ContactEviction.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.Messaging.Handlers.Pub;

using D2.Events.Protos.V1;
using D2.Shared.Handler;

public partial interface IPubs
{
    /// <summary>
    /// Handler for publishing contact eviction events.
    /// </summary>
    public interface IContactEvictionHandler : IHandler<ContactEvictionInput, ContactEvictionOutput>;

    /// <summary>
    /// Input for publishing a contact eviction event.
    /// </summary>
    ///
    /// <param name="Event">
    /// The contacts evicted event to publish.
    /// </param>
    public record ContactEvictionInput(ContactsEvictedEvent Event);

    /// <summary>
    /// Output for publishing a contact eviction event.
    /// </summary>
    public record ContactEvictionOutput;
}
