// -----------------------------------------------------------------------
// <copyright file="ICommands.DeleteContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Interfaces.CQRS.Handlers.C;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;

public partial interface ICommands
{
    /// <summary>
    /// Handler for deleting Geo contacts by ext keys via gRPC.
    /// </summary>
    public interface IDeleteContactsByExtKeysHandler : IHandler<DeleteContactsByExtKeysInput, DeleteContactsByExtKeysOutput>;

    /// <summary>
    /// Input for deleting Geo contacts by ext keys.
    /// </summary>
    ///
    /// <param name="Keys">
    /// The ext keys of the contacts to delete.
    /// </param>
    public record DeleteContactsByExtKeysInput(List<GetContactsExtKeys> Keys);

    /// <summary>
    /// Output for deleting Geo contacts by ext keys.
    /// </summary>
    ///
    /// <param name="Deleted">
    /// The number of contacts deleted.
    /// </param>
    public record DeleteContactsByExtKeysOutput(int Deleted);
}
