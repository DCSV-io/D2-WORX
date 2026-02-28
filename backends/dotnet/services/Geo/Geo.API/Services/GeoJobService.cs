// -----------------------------------------------------------------------
// <copyright file="GeoJobService.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace Geo.API.Services;

using D2.Geo.App.Interfaces.CQRS.Handlers.C;
using D2.Services.Protos.Common.V1;
using D2.Shared.Result.Extensions;
using Geo.API.Interceptors;
using Grpc.Core;
using SB = D2.Services.Protos.Geo.V1.GeoJobService.GeoJobServiceBase;

/// <summary>
/// gRPC service for Geo scheduled jobs.
/// </summary>
public class GeoJobService : SB
{
    private readonly ICommands.IPurgeStaleWhoIsHandler r_purgeStaleWhoIs;
    private readonly ICommands.ICleanupOrphanedLocationsHandler r_cleanupOrphanedLocations;

    /// <summary>
    /// Initializes a new instance of the <see cref="GeoJobService"/> class.
    /// </summary>
    ///
    /// <param name="purgeStaleWhoIs">
    /// The handler for purging stale WhoIs records.
    /// </param>
    /// <param name="cleanupOrphanedLocations">
    /// The handler for cleaning up orphaned locations.
    /// </param>
    public GeoJobService(
        ICommands.IPurgeStaleWhoIsHandler purgeStaleWhoIs,
        ICommands.ICleanupOrphanedLocationsHandler cleanupOrphanedLocations)
    {
        r_purgeStaleWhoIs = purgeStaleWhoIs;
        r_cleanupOrphanedLocations = cleanupOrphanedLocations;
    }

    /// <inheritdoc/>
    [RequiresApiKey]
    public override async Task<TriggerJobResponse> PurgeStaleWhoIs(
        TriggerJobRequest request,
        ServerCallContext context)
    {
        var result = await r_purgeStaleWhoIs.HandleAsync(
            new ICommands.PurgeStaleWhoIsInput(), context.CancellationToken);

        var purgeResponse = new TriggerJobResponse
        {
            Result = result.ToProto(),
            Data = new JobExecutionData
            {
                JobName = "purge-stale-whois",
                ExecutedAt = DateTime.UtcNow.ToString("o"),
            },
        };

        if (result.CheckSuccess(out var purgeOutput) && purgeOutput is not null)
        {
            purgeResponse.Data.RowsAffected = purgeOutput.RowsAffected;
            purgeResponse.Data.DurationMs = purgeOutput.DurationMs;
            purgeResponse.Data.LockAcquired = purgeOutput.LockAcquired;
        }

        return purgeResponse;
    }

    /// <inheritdoc/>
    [RequiresApiKey]
    public override async Task<TriggerJobResponse> CleanupOrphanedLocations(
        TriggerJobRequest request,
        ServerCallContext context)
    {
        var result = await r_cleanupOrphanedLocations.HandleAsync(
            new ICommands.CleanupOrphanedLocationsInput(), context.CancellationToken);

        var cleanupResponse = new TriggerJobResponse
        {
            Result = result.ToProto(),
            Data = new JobExecutionData
            {
                JobName = "cleanup-orphaned-locations",
                ExecutedAt = DateTime.UtcNow.ToString("o"),
            },
        };

        if (result.CheckSuccess(out var cleanupOutput) && cleanupOutput is not null)
        {
            cleanupResponse.Data.RowsAffected = cleanupOutput.RowsAffected;
            cleanupResponse.Data.DurationMs = cleanupOutput.DurationMs;
            cleanupResponse.Data.LockAcquired = cleanupOutput.LockAcquired;
        }

        return cleanupResponse;
    }
}
