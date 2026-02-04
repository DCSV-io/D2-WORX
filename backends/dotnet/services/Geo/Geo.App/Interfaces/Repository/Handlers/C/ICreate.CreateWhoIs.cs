// -----------------------------------------------------------------------
// <copyright file="ICreate.CreateWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.Repository.Handlers.C;

using D2.Geo.Domain.Entities;

public partial interface ICreate
{
    /// <summary>
    /// Handler for upserting WhoIs records.
    /// </summary>
    public interface ICreateWhoIsHandler
        : D2.Contracts.Handler.IHandler<CreateWhoIsInput, CreateWhoIsOutput>;

    /// <summary>
    /// Input for upserting WhoIs records.
    /// </summary>
    ///
    /// <param name="WhoIsRecords">
    /// The list of WhoIs entities to be upserted.
    /// </param>
    public record CreateWhoIsInput(List<WhoIs> WhoIsRecords);

    /// <summary>
    /// Output for upserting WhoIs records.
    /// </summary>
    ///
    /// <param name="Created">
    /// The number of WhoIs records that were created.
    /// </param>
    ///
    /// <remarks>
    /// The <see cref="CreateWhoIsOutput.Created"/> property indicates how many WhoIs records were
    /// created during the upsert operation. <see cref="WhoIs"/> records are immutable, so any
    /// records that already exist in the database will not be counted as created.
    /// </remarks>
    public record CreateWhoIsOutput(int Created);
}
