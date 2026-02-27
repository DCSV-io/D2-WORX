// -----------------------------------------------------------------------
// <copyright file="DeleteContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.D;

using System.Linq.Expressions;
using D2.Geo.Domain.Entities;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using H = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.IDeleteContactsByExtKeysHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.DeleteContactsByExtKeysInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.DeleteContactsByExtKeysOutput;

/// <summary>
/// Handler for deleting Contacts by their external keys from the database.
/// </summary>
public class DeleteContactsByExtKeys : BaseHandler<DeleteContactsByExtKeys, I, O>, H
{
    private readonly GeoDbContext r_db;
    private readonly GeoInfraOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteContactsByExtKeys"/> class.
    /// </summary>
    ///
    /// <param name="db">
    /// The database context.
    /// </param>
    /// <param name="options">
    /// The infrastructure options.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public DeleteContactsByExtKeys(
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
        // If the request was empty, return early.
        if (input.Keys.Count == 0)
        {
            return D2Result<O?>.Ok(new O(0, []));
        }

        // Deduplicate input keys.
        var uniqueKeys = input.Keys.Distinct().ToList();

        // Collect all contacts to delete across batches.
        List<Guid> deletedIds = [];

        foreach (var batch in uniqueKeys.Chunk(r_options.RepoQueryBatchSize))
        {
            // Build an OR predicate for exact (ContextKey, RelatedEntityId) pair matching.
            // This avoids the cross-product false positives from separate IN clauses.
            Expression<Func<Contact, bool>>? predicate = null;
            foreach (var (contextKey, relatedEntityId) in batch)
            {
                var k = contextKey;
                var e = relatedEntityId;
                Expression<Func<Contact, bool>> pair = c => c.ContextKey == k && c.RelatedEntityId == e;
                predicate = predicate is null ? pair : PredicateBuilder.Or(predicate, pair);
            }

            var matched = await r_db.Contacts
                .Where(predicate!)
                .ToListAsync(ct);

            if (matched.Count > 0)
            {
                deletedIds.AddRange(matched.Select(c => c.Id));
                r_db.Contacts.RemoveRange(matched);
            }
        }

        if (deletedIds.Count == 0)
        {
            return D2Result<O?>.Ok(new O(0, []));
        }

        await r_db.SaveChangesAsync(ct);

        return D2Result<O?>.Ok(new O(deletedIds.Count, deletedIds));
    }
}
