// -----------------------------------------------------------------------
// <copyright file="ICreate.CreateContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.Repository.Handlers.C;

using D2.Geo.Domain.Entities;

public partial interface ICreate
{
    /// <summary>
    /// Handler for creating Contacts.
    /// </summary>
    public interface ICreateContactsHandler
        : D2.Contracts.Handler.IHandler<CreateContactsInput, CreateContactsOutput>;

    /// <summary>
    /// Input for creating Contacts.
    /// </summary>
    ///
    /// <param name="Contacts">
    /// The list of Contact entities to be created.
    /// </param>
    public record CreateContactsInput(List<Contact> Contacts);

    /// <summary>
    /// Output for creating Contacts.
    /// </summary>
    public record CreateContactsOutput;
}
