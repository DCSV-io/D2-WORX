// -----------------------------------------------------------------------
// <copyright file="IDelete.DeleteContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.Repository.Handlers.D;

using D2.Shared.Handler;

public partial interface IDelete
{
    /// <summary>
    /// Handler for deleting Contacts by their IDs.
    /// </summary>
    public interface IDeleteContactsHandler
        : IHandler<DeleteContactsInput, DeleteContactsOutput>;

    /// <summary>
    /// Input for deleting Contacts.
    /// </summary>
    ///
    /// <param name="ContactIds">
    /// The list of Contact unique identifiers to delete.
    /// </param>
    public record DeleteContactsInput(List<Guid> ContactIds);

    /// <summary>
    /// Output for deleting Contacts.
    /// </summary>
    ///
    /// <param name="Deleted">
    /// The number of Contacts that were deleted.
    /// </param>
    public record DeleteContactsOutput(int Deleted);
}
