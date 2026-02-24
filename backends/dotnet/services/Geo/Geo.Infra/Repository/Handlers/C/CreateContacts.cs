// -----------------------------------------------------------------------
// <copyright file="CreateContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.C;

using System.Net;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using H = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate.ICreateContactsHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate.CreateContactsInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate.CreateContactsOutput;

/// <summary>
/// Handler for creating Contacts in the database.
/// </summary>
///
/// <remarks>
/// Unlike content-addressable entities (Location, WhoIs), Contacts have GUID primary keys
/// and are always inserted as new records. A unique constraint on (context_key, related_entity_id)
/// prevents duplicate ext-key combinations.
/// </remarks>
public class CreateContacts : BaseHandler<CreateContacts, I, O>, H
{
    private const string _PG_UNIQUE_VIOLATION = "23505";

    private readonly GeoDbContext r_db;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateContacts"/> class.
    /// </summary>
    ///
    /// <param name="db">
    /// The database context.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public CreateContacts(
        GeoDbContext db,
        IHandlerContext context)
        : base(context)
    {
        r_db = db;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.Contacts.Count == 0)
        {
            return D2Result<O?>.Ok(new O());
        }

        try
        {
            r_db.Contacts.AddRange(input.Contacts);
            await r_db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: _PG_UNIQUE_VIOLATION })
        {
            return D2Result<O?>.Fail(
                ["A contact with the same context key and related entity ID already exists."],
                HttpStatusCode.Conflict);
        }

        return D2Result<O?>.Ok(new O());
    }
}
