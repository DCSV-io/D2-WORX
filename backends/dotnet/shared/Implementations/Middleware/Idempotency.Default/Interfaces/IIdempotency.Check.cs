// -----------------------------------------------------------------------
// <copyright file="IIdempotency.Check.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Idempotency.Default.Interfaces;

using D2.Shared.Handler;

public partial interface IIdempotency
{
    /// <summary>
    /// Handler for checking idempotency state using SET NX + GET.
    /// </summary>
    public interface ICheckHandler : IHandler<CheckInput, CheckOutput>;

    /// <summary>
    /// Input for the idempotency check.
    /// </summary>
    ///
    /// <param name="IdempotencyKey">
    /// The client-provided idempotency key (UUID format).
    /// </param>
    public record CheckInput(string IdempotencyKey);

    /// <summary>
    /// Output from the idempotency check.
    /// </summary>
    ///
    /// <param name="State">
    /// The idempotency state: Acquired, InFlight, or Cached.
    /// </param>
    /// <param name="CachedResponse">
    /// The cached response if state is Cached; otherwise null.
    /// </param>
    public record CheckOutput(IdempotencyState State, CachedResponse? CachedResponse);
}
