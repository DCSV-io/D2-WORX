// -----------------------------------------------------------------------
// <copyright file="ICommands.DeleteContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.C;

using D2.Contracts.Handler;

public partial interface ICommands
{
    /// <summary>
    /// Handler for deleting Contacts.
    /// </summary>
    public interface IDeleteContactsHandler
        : IHandler<DeleteContactsInput, DeleteContactsOutput>;

    /// <summary>
    /// Input for deleting Contacts.
    /// </summary>
    ///
    /// <param name="ContactIds">
    /// The list of Contact IDs to delete.
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
