// -----------------------------------------------------------------------
// <copyright file="RequestEnrichmentOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment.Default;

/// <summary>
/// Configuration options for request enrichment middleware.
/// </summary>
public class RequestEnrichmentOptions
{
    /// <summary>
    /// Gets or sets a value indicating whether to perform WhoIs lookups.
    /// </summary>
    /// <remarks>
    /// When enabled, the middleware will call the Geo service to resolve
    /// geographic information for the client IP address.
    /// Default is true.
    /// </remarks>
    public bool EnableWhoIsLookup { get; set; } = true;

    /// <summary>
    /// Gets or sets the header name for client-provided fingerprint.
    /// </summary>
    /// <remarks>
    /// Default is "X-Client-Fingerprint".
    /// </remarks>
    public string ClientFingerprintHeader { get; set; } = "X-Client-Fingerprint";
}
