// -----------------------------------------------------------------------
// <copyright file="ICommands.CreateContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Interfaces.CQRS.Handlers.C;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;

public partial interface ICommands
{
    /// <summary>
    /// Handler for creating Geo contacts via gRPC.
    /// </summary>
    public interface ICreateContactsHandler : IHandler<CreateContactsInput, CreateContactsOutput>;

    /// <summary>
    /// Input for creating Geo contacts.
    /// </summary>
    ///
    /// <param name="Request">
    /// The gRPC request containing the contacts to create.
    /// </param>
    public record CreateContactsInput(CreateContactsRequest Request);

    /// <summary>
    /// Output for creating Geo contacts.
    /// </summary>
    ///
    /// <param name="Data">
    /// The list of created contacts.
    /// </param>
    public record CreateContactsOutput(List<ContactDTO> Data);
}
