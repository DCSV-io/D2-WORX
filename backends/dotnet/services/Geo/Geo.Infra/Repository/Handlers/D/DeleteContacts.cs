// -----------------------------------------------------------------------
// <copyright file="DeleteContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.D;

using D2.Shared.Batch.Pg;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Options;
using H = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.IDeleteContactsHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.DeleteContactsInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.DeleteContactsOutput;

/// <summary>
/// Handler for deleting Contacts from the database.
/// </summary>
public class DeleteContacts : BaseHandler<DeleteContacts, I, O>, H
{
    private readonly GeoDbContext r_db;
    private readonly GeoInfraOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteContacts"/> class.
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
    public DeleteContacts(
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
        if (input.ContactIds.Count == 0)
        {
            return D2Result<O?>.Ok(new O(0));
        }

        // Find contacts to delete using batched query.
        // Note: AsNoTracking must be false to allow deletion of returned entities.
        var contactsToDelete = await r_db.Contacts
            .BatchGetByIds(
                input.ContactIds,
                c => c.Id,
                opts =>
                {
                    opts.BatchSize = r_options.RepoQueryBatchSize;
                    opts.AsNoTracking = false;
                })
            .ToListAsync(ct);

        // If no contacts found, return early.
        if (contactsToDelete.Count == 0)
        {
            return D2Result<O?>.Ok(new O(0));
        }

        // Delete the found contacts.
        r_db.Contacts.RemoveRange(contactsToDelete);
        await r_db.SaveChangesAsync(ct);

        return D2Result<O?>.Ok(new O(contactsToDelete.Count));
    }
}
