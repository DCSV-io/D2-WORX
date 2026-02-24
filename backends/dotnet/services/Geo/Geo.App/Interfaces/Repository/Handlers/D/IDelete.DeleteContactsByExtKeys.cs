// -----------------------------------------------------------------------
// <copyright file="IDelete.DeleteContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.Repository.Handlers.D;

using D2.Shared.Handler;

public partial interface IDelete
{
    /// <summary>
    /// Handler for deleting Contacts by their external keys from the database.
    /// </summary>
    public interface IDeleteContactsByExtKeysHandler
        : IHandler<DeleteContactsByExtKeysInput, DeleteContactsByExtKeysOutput>;

    /// <summary>
    /// Input for deleting Contacts by their external keys.
    /// </summary>
    ///
    /// <param name="Keys">
    /// The list of tuples containing context keys and related entity IDs.
    /// </param>
    public record DeleteContactsByExtKeysInput(
        List<(string ContextKey, Guid RelatedEntityId)> Keys);

    /// <summary>
    /// Output for deleting Contacts by their external keys.
    /// </summary>
    ///
    /// <param name="Deleted">
    /// The number of Contacts that were deleted.
    /// </param>
    /// <param name="DeletedIds">
    /// The list of deleted Contact IDs for cache invalidation.
    /// </param>
    public record DeleteContactsByExtKeysOutput(int Deleted, List<Guid> DeletedIds);
}
