// -----------------------------------------------------------------------
// <copyright file="CreateContacts.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.CQRS.Handlers.C;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Result;
using D2.Shared.Result.Extensions;
using FluentValidation;
using Microsoft.Extensions.Options;
using H = D2.Geo.Client.Interfaces.CQRS.Handlers.C.ICommands.ICreateContactsHandler;
using I = D2.Geo.Client.Interfaces.CQRS.Handlers.C.ICommands.CreateContactsInput;
using O = D2.Geo.Client.Interfaces.CQRS.Handlers.C.ICommands.CreateContactsOutput;

/// <summary>
/// Handler for creating Geo contacts via gRPC.
/// Validates context keys against AllowedContextKeys before calling gRPC.
/// </summary>
public class CreateContacts : BaseHandler<CreateContacts, I, O>, H
{
    private readonly GeoService.GeoServiceClient r_geoClient;
    private readonly GeoClientOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateContacts"/> class.
    /// </summary>
    /// <param name="geoClient">The gRPC client for the Geo service.</param>
    /// <param name="options">The Geo client configuration options.</param>
    /// <param name="context">The handler context providing logging and tracing.</param>
    public CreateContacts(
        GeoService.GeoServiceClient geoClient,
        IOptions<GeoClientOptions> options,
        IHandlerContext context)
        : base(context)
    {
        r_geoClient = geoClient;
        r_options = options.Value;
    }

    /// <inheritdoc />
    protected override HandlerOptions DefaultOptions => new(LogInput: false, LogOutput: false);

    /// <inheritdoc />
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var v = await ValidateInput(
            v => v.RuleFor(i => i.Request)
                .ChildRules(r => r.RuleForEach(req => req.ContactsToCreate)
                    .ChildRules(cr => cr.RuleFor(c => c.ContextKey)
                        .IsAllowedContextKey(r_options.AllowedContextKeys))),
            input,
            ct);
        if (v.Failed)
        {
            return D2Result<O?>.BubbleFail(v);
        }

        var r = await r_geoClient.CreateContactsAsync(
                input.Request,
                cancellationToken: ct)
            .HandleAsync(
                r => r.Result,
                r => r.Data,
                Context.Logger);

        return D2Result<O?>.Bubble(r, new([.. r.Data ?? []]));
    }
}
