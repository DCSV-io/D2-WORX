// -----------------------------------------------------------------------
// <copyright file="D2RetryExternalOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Result.Retry;

/// <summary>
/// Options for <see cref="D2RetryHelper.RetryExternalAsync{TRaw,TData}"/> (dirty retrier).
/// </summary>
public record D2RetryExternalOptions : D2RetryConfig
{
    /// <summary>
    /// Gets a delegate that maps thrown exceptions to D2Result.
    /// Default: <see cref="D2Result{TData}.UnhandledException"/>.
    /// </summary>
    public Func<Exception, D2Result>? MapError { get; init; }

    /// <summary>
    /// Gets a delegate that overrides default D2Result transient detection (applied to mapped result).
    /// Default: <see cref="D2RetryHelper.IsTransientResult"/>.
    /// </summary>
    public Func<D2Result, bool>? IsTransientResult { get; init; }
}
