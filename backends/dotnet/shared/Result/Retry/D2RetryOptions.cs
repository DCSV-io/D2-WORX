// -----------------------------------------------------------------------
// <copyright file="D2RetryOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Result.Retry;

/// <summary>
/// Options for <see cref="D2RetryHelper.RetryResultAsync{TData}"/> (clean retrier).
/// </summary>
public record D2RetryOptions : D2RetryConfig
{
    /// <summary>
    /// Gets a delegate that overrides default D2Result transient detection.
    /// Default: <see cref="D2RetryHelper.IsTransientResult"/>.
    /// </summary>
    public Func<D2Result, bool>? IsTransientResult { get; init; }
}
