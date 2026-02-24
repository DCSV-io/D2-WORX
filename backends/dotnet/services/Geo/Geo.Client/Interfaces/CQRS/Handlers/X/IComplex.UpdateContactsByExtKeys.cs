// -----------------------------------------------------------------------
// <copyright file="IComplex.UpdateContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Interfaces.CQRS.Handlers.X;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;

public partial interface IComplex
{
    /// <summary>
    /// Handler for replacing Geo contacts at given ext keys via gRPC.
    /// </summary>
    /// <remarks>
    /// Geo internally deletes old contacts and creates new ones atomically.
    /// </remarks>
    public interface IUpdateContactsByExtKeysHandler : IHandler<UpdateContactsByExtKeysInput, UpdateContactsByExtKeysOutput>;

    /// <summary>
    /// Input for updating Geo contacts by ext keys.
    /// </summary>
    ///
    /// <param name="Contacts">
    /// The contacts to create as replacements (same shape as CreateContacts).
    /// </param>
    public record UpdateContactsByExtKeysInput(List<ContactToCreateDTO> Contacts);

    /// <summary>
    /// Output for updating Geo contacts by ext keys.
    /// </summary>
    ///
    /// <param name="Replacements">
    /// The replacement mappings (old contact → new contact).
    /// </param>
    public record UpdateContactsByExtKeysOutput(List<ContactReplacement> Replacements);
}
