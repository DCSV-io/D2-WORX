// -----------------------------------------------------------------------
// <copyright file="GetContactsByIds.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.R;

using D2.Contracts.Batch.Pg;
using D2.Contracts.Handler;
using D2.Contracts.Result;
using Microsoft.Extensions.Options;
using H = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead.IGetContactsByIdsHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead.GetContactsByIdsInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead.GetContactsByIdsOutput;

/// <summary>
/// Handler for getting Contacts by their IDs from the database.
/// </summary>
public class GetContactsByIds : BaseHandler<GetContactsByIds, I, O>, H
{
    private readonly GeoDbContext r_db;
    private readonly GeoInfraOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetContactsByIds"/> class.
    /// </summary>
    ///
    /// <param name="db">
    /// The database context.
    /// </param>
    /// <param name="options">
    /// The Geo infrastructure options.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public GetContactsByIds(
        GeoDbContext db,
        IOptions<GeoInfraOptions> options,
        IHandlerContext context)
        : base(context)
    {
        r_db = db;
        r_options = options.Value;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var result = await r_db.Contacts
            .BatchGetByIds(
                input.ContactIds,
                c => c.Id,
                opts => opts.BatchSize = r_options.RepoQueryBatchSize)
            .ToDictionaryD2ResultAsync(TraceId, ct);

        // Handle success case first.
        if (result.Success)
        {
            return D2Result<O?>.Ok(new O(result.Data!), traceId: TraceId);
        }

        // Handle partial success and not found - these have specific semantics.
        // For any other errors, bubble up the failure.
        return result.ErrorCode switch
        {
            ErrorCodes.SOME_FOUND => D2Result<O?>.SomeFound(new O(result.Data!), traceId: TraceId),
            ErrorCodes.NOT_FOUND => D2Result<O?>.NotFound(traceId: TraceId),
            _ => D2Result<O?>.BubbleFail(result),
        };
    }
}
