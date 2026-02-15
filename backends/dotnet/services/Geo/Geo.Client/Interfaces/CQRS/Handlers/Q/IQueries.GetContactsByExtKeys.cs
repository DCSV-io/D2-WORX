// -----------------------------------------------------------------------
// <copyright file="IQueries.GetContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Interfaces.CQRS.Handlers.Q;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;

public partial interface IQueries
{
    /// <summary>
    /// Handler for fetching Geo contacts by ext keys with local cache-aside.
    /// </summary>
    /// <remarks>
    /// Contacts are immutable, so cached entries never expire (only LRU eviction).
    /// Fail-open: returns whatever was cached if gRPC fails.
    /// </remarks>
    public interface IGetContactsByExtKeysHandler : IHandler<GetContactsByExtKeysInput, GetContactsByExtKeysOutput>;

    /// <summary>
    /// Input for fetching Geo contacts by ext keys.
    /// </summary>
    ///
    /// <param name="Keys">
    /// The ext keys to look up.
    /// </param>
    public record GetContactsByExtKeysInput(List<GetContactsExtKeys> Keys);

    /// <summary>
    /// Output for fetching Geo contacts by ext keys.
    /// </summary>
    ///
    /// <param name="Data">
    /// A dictionary mapping "contextKey:relatedEntityId" to contact lists.
    /// </param>
    public record GetContactsByExtKeysOutput(Dictionary<string, List<ContactDTO>> Data);
}
