// -----------------------------------------------------------------------
// <copyright file="UpdateContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.CQRS.Handlers.X;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.D;
using D2.Shared.Result;
using D2.Shared.Result.Extensions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using H = D2.Geo.Client.Interfaces.CQRS.Handlers.X.IComplex.IUpdateContactsByExtKeysHandler;
using I = D2.Geo.Client.Interfaces.CQRS.Handlers.X.IComplex.UpdateContactsByExtKeysInput;
using O = D2.Geo.Client.Interfaces.CQRS.Handlers.X.IComplex.UpdateContactsByExtKeysOutput;

/// <summary>
/// Handler for replacing Geo contacts at given ext keys via gRPC.
/// Geo internally deletes old contacts and creates new ones atomically.
/// Evicts ext-key cache for each input contact's key.
/// </summary>
public class UpdateContactsByExtKeys : BaseHandler<UpdateContactsByExtKeys, I, O>, H
{
    private readonly IDelete.IRemoveHandler r_cacheRemove;
    private readonly GeoService.GeoServiceClient r_geoClient;
    private readonly GeoClientOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdateContactsByExtKeys"/> class.
    /// </summary>
    /// <param name="cacheRemove">The in-memory cache remove handler for evicting cached entries.</param>
    /// <param name="geoClient">The gRPC client for the Geo service.</param>
    /// <param name="options">The Geo client configuration options.</param>
    /// <param name="context">The handler context providing logging and tracing.</param>
    public UpdateContactsByExtKeys(
        IDelete.IRemoveHandler cacheRemove,
        GeoService.GeoServiceClient geoClient,
        IOptions<GeoClientOptions> options,
        IHandlerContext context)
        : base(context)
    {
        r_cacheRemove = cacheRemove;
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
            v => v.RuleForEach(i => i.Contacts)
                .ChildRules(cr => cr.RuleFor(c => c.ContextKey)
                    .IsAllowedContextKey(r_options.AllowedContextKeys)),
            input,
            ct);
        if (v.Failed)
        {
            return D2Result<O?>.BubbleFail(v);
        }

        var r = await r_geoClient.UpdateContactsByExtKeysAsync(
                new UpdateContactsByExtKeysRequest { Contacts = { input.Contacts } },
                cancellationToken: ct)
            .HandleAsync(
                r => r.Result,
                r => r.Replacements,
                Context.Logger);

        // Evict ext-key cache for each input contact regardless of gRPC result.
        foreach (var contact in input.Contacts)
        {
            var removeR = await r_cacheRemove.HandleAsync(
                new($"contact-ext:{contact.ContextKey}:{contact.RelatedEntityId}"), ct);
            if (removeR.Failed)
            {
                Context.Logger.LogWarning(
                    "Failed to evict contact-ext:{ContextKey}:{RelatedEntityId} from cache. TraceId: {TraceId}",
                    contact.ContextKey,
                    contact.RelatedEntityId,
                    TraceId);
            }
        }

        return D2Result<O?>.Bubble(r, new([.. r.Data ?? []]));
    }
}
