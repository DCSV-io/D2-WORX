// -----------------------------------------------------------------------
// <copyright file="GetContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.CQRS.Handlers.Q;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.R;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.U;
using D2.Shared.Result;
using FluentValidation;
using Grpc.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using H = D2.Geo.Client.Interfaces.CQRS.Handlers.Q.IQueries.IGetContactsByExtKeysHandler;
using I = D2.Geo.Client.Interfaces.CQRS.Handlers.Q.IQueries.GetContactsByExtKeysInput;
using O = D2.Geo.Client.Interfaces.CQRS.Handlers.Q.IQueries.GetContactsByExtKeysOutput;

/// <summary>
/// Handler for fetching Geo contacts by ext keys with local cache-aside.
/// </summary>
/// <remarks>
/// Contacts are immutable, so cached entries never expire (only LRU eviction).
/// Fail-open: returns whatever was cached if gRPC fails.
/// </remarks>
public class GetContactsByExtKeys : BaseHandler<GetContactsByExtKeys, I, O>, H
{
    private readonly IRead.IGetHandler<List<ContactDTO>> r_cacheGet;
    private readonly IUpdate.ISetHandler<List<ContactDTO>> r_cacheSet;
    private readonly GeoService.GeoServiceClient r_geoClient;
    private readonly GeoClientOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetContactsByExtKeys"/> class.
    /// </summary>
    /// <param name="cacheGet">The in-memory cache get handler for reading cached contacts.</param>
    /// <param name="cacheSet">The in-memory cache set handler for storing fetched contacts.</param>
    /// <param name="geoClient">The gRPC client for the Geo service.</param>
    /// <param name="options">The Geo client configuration options.</param>
    /// <param name="context">The handler context providing logging and tracing.</param>
    public GetContactsByExtKeys(
        IRead.IGetHandler<List<ContactDTO>> cacheGet,
        IUpdate.ISetHandler<List<ContactDTO>> cacheSet,
        GeoService.GeoServiceClient geoClient,
        IOptions<GeoClientOptions> options,
        IHandlerContext context)
        : base(context)
    {
        r_cacheGet = cacheGet;
        r_cacheSet = cacheSet;
        r_geoClient = geoClient;
        r_options = options.Value;
    }

    /// <inheritdoc />
    protected override HandlerOptions DefaultOptions => new(LogOutput: false);

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

        if (input.Keys.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]));
        }

        var result = new Dictionary<string, List<ContactDTO>>();
        var missingKeys = new List<GetContactsExtKeys>();

        // Check cache first.
        foreach (var key in input.Keys)
        {
            var cacheKey = $"contact-ext:{key.ContextKey}:{key.RelatedEntityId}";
            var getR = await r_cacheGet.HandleAsync(new(cacheKey), ct);
            if (getR.CheckSuccess(out var cached) && cached?.Value is not null)
            {
                result[$"{key.ContextKey}:{key.RelatedEntityId}"] = cached.Value;
            }
            else
            {
                missingKeys.Add(key);
            }
        }

        // All cached — return early.
        if (missingKeys.Count == 0)
        {
            return D2Result<O?>.Ok(new O(result));
        }

        // Fetch cache misses from Geo service.
        GetContactsByExtKeysResponse response;
        try
        {
            response = await r_geoClient.GetContactsByExtKeysAsync(
                new GetContactsByExtKeysRequest { Keys = { missingKeys } },
                cancellationToken: ct);
        }
        catch (RpcException ex)
        {
            // Fail-open: return whatever was cached.
            Context.Logger.LogWarning(
                ex,
                "gRPC call to Geo service failed for GetContactsByExtKeys. TraceId: {TraceId}",
                TraceId);

            return D2Result<O?>.Ok(new O(result));
        }

        if (response.Result is { Success: true })
        {
            // Cache each fetched result (no expiration — contacts are immutable, LRU evicts).
            foreach (var entry in response.Data)
            {
                if (entry.Key is not null)
                {
                    var mapKey = $"{entry.Key.ContextKey}:{entry.Key.RelatedEntityId}";
                    var cacheKey = $"contact-ext:{entry.Key.ContextKey}:{entry.Key.RelatedEntityId}";
                    var contacts = entry.Contacts.ToList();

                    var setR = await r_cacheSet.HandleAsync(new(cacheKey, contacts), ct);
                    if (setR.Failed)
                    {
                        Context.Logger.LogWarning(
                            "Failed to cache contact-ext:{ContextKey}:{RelatedEntityId}. TraceId: {TraceId}",
                            entry.Key.ContextKey,
                            entry.Key.RelatedEntityId,
                            TraceId);
                    }

                    result[mapKey] = contacts;
                }
            }
        }

        return D2Result<O?>.Ok(new O(result));
    }
}
