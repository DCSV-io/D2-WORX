// -----------------------------------------------------------------------
// <copyright file="DeleteContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.CQRS.Handlers.C;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.D;
using D2.Shared.Result;
using D2.Shared.Result.Extensions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using H = D2.Geo.Client.Interfaces.CQRS.Handlers.C.ICommands.IDeleteContactsByExtKeysHandler;
using I = D2.Geo.Client.Interfaces.CQRS.Handlers.C.ICommands.DeleteContactsByExtKeysInput;
using O = D2.Geo.Client.Interfaces.CQRS.Handlers.C.ICommands.DeleteContactsByExtKeysOutput;

/// <summary>
/// Handler for deleting Geo contacts by ext keys via gRPC.
/// Evicts deleted contacts from the local ext-key cache.
/// </summary>
public class DeleteContactsByExtKeys : BaseHandler<DeleteContactsByExtKeys, I, O>, H
{
    private readonly IDelete.IRemoveHandler r_cacheRemove;
    private readonly GeoService.GeoServiceClient r_geoClient;
    private readonly GeoClientOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteContactsByExtKeys"/> class.
    /// </summary>
    /// <param name="cacheRemove">The in-memory cache remove handler for evicting cached entries.</param>
    /// <param name="geoClient">The gRPC client for the Geo service.</param>
    /// <param name="options">The Geo client configuration options.</param>
    /// <param name="context">The handler context providing logging and tracing.</param>
    public DeleteContactsByExtKeys(
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
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var v = await ValidateInput(
            v => v.RuleForEach(i => i.Keys)
                .ChildRules(cr => cr.RuleFor(k => k.ContextKey)
                    .IsAllowedContextKey(r_options.AllowedContextKeys)),
            input,
            ct);
        if (v.Failed)
        {
            return D2Result<O?>.BubbleFail(v);
        }

        var r = await r_geoClient.DeleteContactsByExtKeysAsync(
                new DeleteContactsByExtKeysRequest { Keys = { input.Keys } },
                cancellationToken: ct)
            .HandleAsync(
                r => r.Result,
                r => r.Deleted,
                Context.Logger,
                TraceId);

        // Evict ext-key cache for each input key regardless of gRPC result.
        foreach (var key in input.Keys)
        {
            var removeR = await r_cacheRemove.HandleAsync(
                new($"contact-ext:{key.ContextKey}:{key.RelatedEntityId}"), ct);
            if (removeR.Failed)
            {
                Context.Logger.LogWarning(
                    "Failed to evict contact-ext:{ContextKey}:{RelatedEntityId} from cache. TraceId: {TraceId}",
                    key.ContextKey,
                    key.RelatedEntityId,
                    TraceId);
            }
        }

        return D2Result<O?>.Bubble(r, new(r.Data));
    }
}
