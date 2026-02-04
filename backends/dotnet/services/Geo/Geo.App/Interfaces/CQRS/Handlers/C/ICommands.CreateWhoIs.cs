// -----------------------------------------------------------------------
// <copyright file="ICommands.CreateWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.C;

using D2.Shared.Handler;
using D2.Geo.Domain.Entities;

public partial interface ICommands
{
    /// <summary>
    /// Handler for creating WhoIs records.
    /// </summary>
    public interface ICreateWhoIsHandler
        : IHandler<CreateWhoIsInput, CreateWhoIsOutput>;

    /// <summary>
    /// Input for creating WhoIs records.
    /// </summary>
    ///
    /// <param name="WhoIsRecords">
    /// The list of WhoIs domain entities to be created.
    /// </param>
    ///
    /// <remarks>
    /// Uses domain entities directly since WhoIs records are typically created
    /// from external API responses rather than user input.
    /// </remarks>
    public record CreateWhoIsInput(List<WhoIs> WhoIsRecords);

    /// <summary>
    /// Output for creating WhoIs records.
    /// </summary>
    ///
    /// <param name="Created">
    /// The number of WhoIs records that were created (excludes duplicates).
    /// </param>
    public record CreateWhoIsOutput(int Created);
}
