// -----------------------------------------------------------------------
// <copyright file="InfrastructurePaths.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment.Default;

using Microsoft.AspNetCore.Http;

/// <summary>
/// Identifies infrastructure endpoints (health checks, metrics) that should bypass
/// request enrichment, rate limiting, and other business middleware.
/// </summary>
public static class InfrastructurePaths
{
    /// <summary>
    /// Returns <see langword="true"/> if the request targets an infrastructure endpoint
    /// that should be excluded from business middleware processing.
    /// </summary>
    ///
    /// <param name="context">The HTTP context.</param>
    ///
    /// <returns>
    /// <see langword="true"/> for <c>/health</c>, <c>/alive</c>, <c>/metrics</c>,
    /// and <c>/api/health</c>; otherwise <see langword="false"/>.
    /// </returns>
    public static bool IsInfrastructure(HttpContext context)
    {
        return context.Request.Path.StartsWithSegments("/health", StringComparison.OrdinalIgnoreCase) ||
               context.Request.Path.StartsWithSegments("/alive", StringComparison.OrdinalIgnoreCase) ||
               context.Request.Path.StartsWithSegments("/metrics", StringComparison.OrdinalIgnoreCase) ||
               context.Request.Path.StartsWithSegments("/api/health", StringComparison.OrdinalIgnoreCase);
    }
}
