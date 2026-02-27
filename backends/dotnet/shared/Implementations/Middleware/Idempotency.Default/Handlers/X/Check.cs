// -----------------------------------------------------------------------
// <copyright file="Check.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Idempotency.Default.Handlers.X;

using System.Text.Json;
using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.C;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.R;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using H = D2.Shared.Idempotency.Default.Interfaces.IIdempotency.ICheckHandler;
using I = D2.Shared.Idempotency.Default.Interfaces.IIdempotency.CheckInput;
using O = D2.Shared.Idempotency.Default.Interfaces.IIdempotency.CheckOutput;

/// <summary>
/// Handler for checking idempotency state using SET NX + GET pattern.
/// </summary>
/// <remarks>
/// Complex handler (X/) because it may mutate shared state (creates Redis keys)
/// while its primary intent is retrieval of state.
/// </remarks>
public class Check : BaseHandler<Check, I, O>, H
{
    private const string _SENTINEL = "__processing__";
    private const string _KEY_PREFIX = "idempotency:";

    private readonly ICreate.ISetNxHandler<string> r_setNx;
    private readonly IRead.IGetHandler<string> r_get;
    private readonly IdempotencyOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="Check"/> class.
    /// </summary>
    ///
    /// <param name="setNx">
    /// The handler for SET NX operations.
    /// </param>
    /// <param name="get">
    /// The handler for GET operations.
    /// </param>
    /// <param name="options">
    /// The idempotency options.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Check(
        ICreate.ISetNxHandler<string> setNx,
        IRead.IGetHandler<string> get,
        IOptions<IdempotencyOptions> options,
        IHandlerContext context)
        : base(context)
    {
        r_setNx = setNx;
        r_get = get;
        r_options = options.Value;
    }

    /// <inheritdoc />
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var cacheKey = $"{_KEY_PREFIX}{input.IdempotencyKey}";

        try
        {
            // 1. Attempt to acquire the lock with SET NX.
            var setNxResult = await r_setNx.HandleAsync(
                new ICreate.SetNxInput<string>(cacheKey, _SENTINEL, r_options.InFlightTtl),
                ct);

            if (setNxResult.CheckSuccess(out var setNxOutput) && setNxOutput?.WasSet == true)
            {
                // Lock acquired — caller should proceed with request processing.
                return D2Result<O?>.Ok(
                    new O(IdempotencyState.Acquired, null));
            }

            // 2. Key exists — check if it's a sentinel or a cached response.
            var getResult = await r_get.HandleAsync(
                new IRead.GetInput(cacheKey),
                ct);

            if (!getResult.CheckSuccess(out var getOutput) || getOutput?.Value is null)
            {
                // GET failed or returned null — key may have expired between SET NX and GET.
                // Fail-open: treat as acquired.
                Context.Logger.LogWarning(
                    "Idempotency key exists but GET returned no value. Failing open. TraceId: {TraceId}",
                    TraceId);

                return D2Result<O?>.Ok(
                    new O(IdempotencyState.Acquired, null));
            }

            // 3. Check if sentinel (in-flight) or cached response.
            if (getOutput.Value == _SENTINEL)
            {
                return D2Result<O?>.Ok(
                    new O(IdempotencyState.InFlight, null));
            }

            // 4. Try to parse as CachedResponse.
            try
            {
                var cachedResponse = JsonSerializer.Deserialize<CachedResponse>(getOutput.Value);
                if (cachedResponse is not null)
                {
                    return D2Result<O?>.Ok(
                        new O(IdempotencyState.Cached, cachedResponse));
                }
            }
            catch (JsonException ex)
            {
                Context.Logger.LogWarning(
                    ex,
                    "Failed to deserialize cached response for idempotency key. Failing open. TraceId: {TraceId}",
                    TraceId);
            }

            // Could not parse — fail-open: treat as acquired.
            return D2Result<O?>.Ok(
                new O(IdempotencyState.Acquired, null));
        }
        catch (Exception ex)
        {
            // Fail-open on all cache errors.
            Context.Logger.LogWarning(
                ex,
                "Idempotency check failed. Failing open. TraceId: {TraceId}",
                TraceId);

            return D2Result<O?>.Ok(
                new O(IdempotencyState.Acquired, null));
        }
    }
}
