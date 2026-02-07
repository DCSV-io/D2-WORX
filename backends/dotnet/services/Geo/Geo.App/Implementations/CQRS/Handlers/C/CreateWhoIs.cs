// -----------------------------------------------------------------------
// <copyright file="CreateWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.C;

using D2.Shared.Handler;
using D2.Shared.Result;
using CreateRepo = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate;
using H = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.ICreateWhoIsHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.CreateWhoIsInput;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.CreateWhoIsOutput;

/// <summary>
/// Handler for creating WhoIs records.
/// </summary>
public class CreateWhoIs : BaseHandler<CreateWhoIs, I, O>, H
{
    private readonly CreateRepo.ICreateWhoIsHandler r_createWhoIsInRepo;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateWhoIs"/> class.
    /// </summary>
    ///
    /// <param name="createWhoIsInRepo">
    /// The repository handler for creating WhoIs records.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public CreateWhoIs(
        CreateRepo.ICreateWhoIsHandler createWhoIsInRepo,
        IHandlerContext context)
        : base(context)
    {
        r_createWhoIsInRepo = createWhoIsInRepo;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.WhoIsRecords.Count == 0)
        {
            return D2Result<O?>.Ok(new O(0), traceId: TraceId);
        }

        // Create in repository.
        var repoR = await r_createWhoIsInRepo.HandleAsync(new(input.WhoIsRecords), ct);

        if (repoR.CheckFailure(out var repoOutput))
        {
            return D2Result<O?>.BubbleFail(repoR);
        }

        return D2Result<O?>.Ok(new O(repoOutput!.Created), traceId: TraceId);
    }
}
