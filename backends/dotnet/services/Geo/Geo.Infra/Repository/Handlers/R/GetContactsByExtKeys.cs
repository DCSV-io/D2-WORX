// -----------------------------------------------------------------------
// <copyright file="GetContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.R;

using D2.Shared.Handler;
using D2.Shared.Result;
using D2.Geo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using H = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead.IGetContactsByExtKeysHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead.GetContactsByExtKeysInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead.GetContactsByExtKeysOutput;

/// <summary>
/// Handler for getting Contacts by their external keys (ContextKey + RelatedEntityId) from the database.
/// </summary>
public class GetContactsByExtKeys : BaseHandler<GetContactsByExtKeys, I, O>, H
{
    private readonly GeoDbContext r_db;
    private readonly GeoInfraOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetContactsByExtKeys"/> class.
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
    public GetContactsByExtKeys(
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
        // Early return for empty input.
        if (input.ContactExtKeys.Count == 0)
        {
            return D2Result<O?>.Ok(
                new O([]),
                traceId: TraceId);
        }

        // Deduplicate input keys.
        var uniqueKeys = input.ContactExtKeys.Distinct().ToList();

        // Build result dictionary.
        var results = new Dictionary<(string ContextKey, Guid RelatedEntityId), List<Contact>>();

        // Query in batches to avoid large IN clauses.
        foreach (var batch in uniqueKeys.Chunk(r_options.RepoQueryBatchSize))
        {
            // Build a query that matches any of the (ContextKey, RelatedEntityId) pairs.
            // Since we can't use tuples directly in EF, we need to build the predicate.
            var contextKeys = batch.Select(k => k.ContextKey).Distinct().ToList();
            var relatedEntityIds = batch.Select(k => k.RelatedEntityId).Distinct().ToList();

            var contacts = await r_db.Contacts
                .AsNoTracking()
                .Where(c => contextKeys.Contains(c.ContextKey) && relatedEntityIds.Contains(c.RelatedEntityId))
                .ToListAsync(ct);

            // Group by the exact (ContextKey, RelatedEntityId) pairs that were requested.
            foreach (var contact in contacts)
            {
                var key = (contact.ContextKey, contact.RelatedEntityId);

                // Only include if this key was actually requested.
                if (!batch.Contains(key))
                {
                    continue;
                }

                if (!results.TryGetValue(key, out var list))
                {
                    list = [];
                    results[key] = list;
                }

                list.Add(contact);
            }
        }

        // Determine result status.
        if (results.Count == 0)
        {
            return D2Result<O?>.NotFound(traceId: TraceId);
        }

        if (results.Count < uniqueKeys.Count)
        {
            return D2Result<O?>.SomeFound(new O(results), traceId: TraceId);
        }

        return D2Result<O?>.Ok(new O(results), traceId: TraceId);
    }
}
