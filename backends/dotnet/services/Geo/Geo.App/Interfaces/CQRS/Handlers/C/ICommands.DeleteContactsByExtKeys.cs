// -----------------------------------------------------------------------
// <copyright file="ICommands.DeleteContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.C;

using D2.Shared.Handler;

public partial interface ICommands
{
    /// <summary>
    /// Handler for deleting Contacts by their external keys.
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
    public record DeleteContactsByExtKeysOutput(int Deleted);
}
