// -----------------------------------------------------------------------
// <copyright file="CircuitOpenException.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Utilities.CircuitBreaker;

/// <summary>
/// Thrown when a circuit breaker is open and no fallback is provided.
/// </summary>
public class CircuitOpenException : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="CircuitOpenException"/> class.
    /// </summary>
    public CircuitOpenException()
        : base("Circuit breaker is open")
    {
    }
}
