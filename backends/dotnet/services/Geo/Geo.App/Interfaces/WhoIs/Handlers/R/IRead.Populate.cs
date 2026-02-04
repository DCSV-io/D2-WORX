// -----------------------------------------------------------------------
// <copyright file="IRead.Populate.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.WhoIs.Handlers.R;

using D2.Shared.Handler;
using D2.Geo.Domain.Entities;

public partial interface IRead
{
    /// <summary>
    /// Handler for populating WhoIs records with data from external sources.
    /// </summary>
    /// <remarks>
    /// Takes partial WhoIs records (with identity fields: IP, year, month, fingerprint)
    /// and returns fully populated records with ASN, location, privacy flags, etc.
    /// Also creates any required Location records.
    /// </remarks>
    public interface IPopulateHandler
        : IHandler<PopulateInput, PopulateOutput>;

    /// <summary>
    /// Input for populating WhoIs records.
    /// </summary>
    ///
    /// <param name="WhoIsRecords">
    /// Dictionary of WhoIs hash IDs to partial WhoIs records (with identity fields populated).
    /// </param>
    public record PopulateInput(Dictionary<string, WhoIs> WhoIsRecords);

    /// <summary>
    /// Output for populating WhoIs records.
    /// </summary>
    ///
    /// <param name="WhoIsRecords">
    /// Dictionary of WhoIs hash IDs to fully populated WhoIs records.
    /// Records that could not be populated are excluded.
    /// </param>
    public record PopulateOutput(Dictionary<string, WhoIs> WhoIsRecords);
}
