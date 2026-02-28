// -----------------------------------------------------------------------
// <copyright file="IDelete.DeleteStaleWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.Repository.Handlers.D;

using D2.Shared.Handler;

public partial interface IDelete
{
    /// <summary>
    /// Handler for deleting WhoIs records older than a given cutoff year/month.
    /// </summary>
    public interface IDeleteStaleWhoIsHandler
        : IHandler<DeleteStaleWhoIsInput, DeleteStaleWhoIsOutput>;

    /// <summary>
    /// Input for deleting stale WhoIs records.
    /// </summary>
    ///
    /// <param name="CutoffYear">
    /// The cutoff year. Records with Year less than this are deleted.
    /// Records with Year equal to this AND Month less than CutoffMonth are also deleted.
    /// </param>
    /// <param name="CutoffMonth">
    /// The cutoff month (1-12). Used in conjunction with CutoffYear.
    /// </param>
    public record DeleteStaleWhoIsInput(int CutoffYear, int CutoffMonth);

    /// <summary>
    /// Output for deleting stale WhoIs records.
    /// </summary>
    ///
    /// <param name="RowsAffected">
    /// The number of stale WhoIs records deleted.
    /// </param>
    public record DeleteStaleWhoIsOutput(int RowsAffected);
}
