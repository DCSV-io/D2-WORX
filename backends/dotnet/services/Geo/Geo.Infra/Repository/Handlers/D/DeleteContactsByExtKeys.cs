// -----------------------------------------------------------------------
// <copyright file="DeleteContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.D;

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
            // Build a query that matches any of the (ContextKey, RelatedEntityId) pairs.
            var contextKeys = batch.Select(k => k.ContextKey).Distinct().ToList();
            var relatedEntityIds = batch.Select(k => k.RelatedEntityId).Distinct().ToList();

            var contacts = await r_db.Contacts
                .Where(c => contextKeys.Contains(c.ContextKey) && relatedEntityIds.Contains(c.RelatedEntityId))
                .ToListAsync(ct);

            // Filter to only contacts that match exact requested pairs.
            var matched = contacts
                .Where(c => batch.Contains((c.ContextKey, c.RelatedEntityId)))
                .ToList();

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
