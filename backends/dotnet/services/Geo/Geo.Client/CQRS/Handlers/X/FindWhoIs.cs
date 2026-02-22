// -----------------------------------------------------------------------
// <copyright file="FindWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.CQRS.Handlers.X;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.R;
using D2.Shared.Interfaces.Caching.InMemory.Handlers.U;
using D2.Shared.Result;
using Grpc.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using H = D2.Geo.Client.Interfaces.CQRS.Handlers.X.IComplex.IFindWhoIsHandler;
using I = D2.Geo.Client.Interfaces.CQRS.Handlers.X.IComplex.FindWhoIsInput;
using O = D2.Geo.Client.Interfaces.CQRS.Handlers.X.IComplex.FindWhoIsOutput;

/// <summary>
/// Handler for finding WhoIs data by IP address and user agent.
/// </summary>
/// <remarks>
/// This implementation checks the local memory cache first, then falls back to
/// the Geo service via gRPC if not cached. Results are cached for future lookups.
/// </remarks>
public class FindWhoIs : BaseHandler<FindWhoIs, I, O>, H
{
    private readonly IRead.IGetHandler<WhoIsDTO> r_cacheGet;
    private readonly IUpdate.ISetHandler<WhoIsDTO> r_cacheSet;
    private readonly GeoService.GeoServiceClient r_geoClient;
    private readonly GeoClientOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="FindWhoIs"/> class.
    /// </summary>
    ///
    /// <param name="cacheGet">
    /// The cache get handler.
    /// </param>
    /// <param name="cacheSet">
    /// The cache set handler.
    /// </param>
    /// <param name="geoClient">
    /// The Geo service gRPC client.
    /// </param>
    /// <param name="options">
    /// The Geo client options.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public FindWhoIs(
        IRead.IGetHandler<WhoIsDTO> cacheGet,
        IUpdate.ISetHandler<WhoIsDTO> cacheSet,
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

    /// <summary>
    /// Finds WhoIs data for the given IP address and user agent.
    /// </summary>
    ///
    /// <param name="input">
    /// The input containing IP address and user agent.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> containing a <see cref="D2Result{O}"/> with the WhoIs data
    /// if found; otherwise, null. Returns Ok with null on failures (fail-open behavior).
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var cacheKey = $"whois:{input.IpAddress}:{input.UserAgent}";

        // Try cache first.
        var getR = await r_cacheGet.HandleAsync(new(cacheKey), ct);
        if (getR.CheckSuccess(out var cached) && cached?.Value is not null)
        {
            return D2Result<O?>.Ok(new O(cached.Value));
        }

        // Cache miss — call Geo service.
        FindWhoIsResponse response;
        try
        {
            response = await r_geoClient.FindWhoIsAsync(
                new FindWhoIsRequest
                {
                    Requests =
                    {
                        new FindWhoIsKeys
                        {
                            IpAddress = input.IpAddress,
                            Fingerprint = input.UserAgent,
                        },
                    },
                },
                cancellationToken: ct);
        }
        catch (RpcException ex)
        {
            // Fail-open: log warning and return null, not error.
            // Note: Do not log input.IpAddress as a scalar — it bypasses [RedactData]
            // destructuring. Use {@Input} for structured logging or omit PII entirely.
            Context.Logger.LogWarning(
                ex,
                "gRPC call to Geo service failed for {@Input}. TraceId: {TraceId}",
                input,
                TraceId);

            return D2Result<O?>.Ok(new O(null));
        }

        if (!response.Result.Success || response.Data.Count == 0)
        {
            // No data found or request failed — return null (fail-open).
            return D2Result<O?>.Ok(new O(null));
        }

        var whoIs = response.Data[0].Whois;

        // Store in cache.
        var setR = await r_cacheSet.HandleAsync(
            new(cacheKey, whoIs, r_options.WhoIsCacheExpiration),
            ct);

        if (setR.Failed)
        {
            // Note: Do not log input.IpAddress as a scalar — it bypasses [RedactData]
            // destructuring. Use {@Input} for structured logging or omit PII entirely.
            Context.Logger.LogWarning(
                "Failed to cache WhoIs for {@Input}. TraceId: {TraceId}",
                input,
                TraceId);
        }

        return D2Result<O?>.Ok(new O(whoIs));
    }
}
