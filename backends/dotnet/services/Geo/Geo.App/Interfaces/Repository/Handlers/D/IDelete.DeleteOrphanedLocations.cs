// -----------------------------------------------------------------------
// <copyright file="IDelete.DeleteOrphanedLocations.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.Repository.Handlers.D;

using D2.Shared.Handler;

public partial interface IDelete
{
    /// <summary>
    /// Handler for deleting locations with zero contact and zero WhoIs references.
    /// </summary>
    public interface IDeleteOrphanedLocationsHandler
        : IHandler<DeleteOrphanedLocationsInput, DeleteOrphanedLocationsOutput>;

    /// <summary>
    /// Input for deleting orphaned locations.
    /// </summary>
    public record DeleteOrphanedLocationsInput;

    /// <summary>
    /// Output for deleting orphaned locations.
    /// </summary>
    ///
    /// <param name="RowsAffected">
    /// The number of orphaned locations deleted.
    /// </param>
    public record DeleteOrphanedLocationsOutput(int RowsAffected);
}
