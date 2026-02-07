// -----------------------------------------------------------------------
// <copyright file="ICommands.CreateContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.C;

using D2.Services.Protos.Geo.V1;

public partial interface ICommands
{
    /// <summary>
    /// Handler for creating Contacts.
    /// </summary>
    public interface ICreateContactsHandler
        : D2.Shared.Handler.IHandler<CreateContactsInput, CreateContactsOutput>;

    /// <summary>
    /// Input for creating Contacts.
    /// </summary>
    ///
    /// <param name="Request">
    /// The request containing the contacts to be created.
    /// </param>
    public record CreateContactsInput(CreateContactsRequest Request);

    /// <summary>
    /// Output for creating Contacts.
    /// </summary>
    ///
    /// <param name="Data">
    /// The list of created ContactDTOs.
    /// </param>
    public record CreateContactsOutput(List<ContactDTO> Data);
}
