// -----------------------------------------------------------------------
// <copyright file="MutableRequestContext.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment.Default;

using D2.Shared.Handler;

/// <summary>
/// Mutable implementation of <see cref="IRequestContext"/> that is progressively
/// populated by gateway middleware. Downstream consumers see the read-only
/// <see cref="IRequestContext"/> interface.
/// </summary>
/// <remarks>
/// <para>
/// Created by <see cref="RequestEnrichmentMiddleware"/> with network fields,
/// then mutated by <c>ServiceKeyMiddleware</c> (trust flag) and
/// <c>JwtFingerprintMiddleware</c> (auth/org fields).
/// </para>
/// </remarks>
public class MutableRequestContext : IRequestContext
{
    #region Tracing

    /// <inheritdoc/>
    public string? TraceId { get; init; }

    /// <inheritdoc/>
    public string? RequestId { get; init; }

    /// <inheritdoc/>
    public string? RequestPath { get; init; }

    #endregion

    #region User / Identity

    /// <inheritdoc/>
    public bool IsAuthenticated { get; set; }

    /// <summary>
    /// Gets or sets the raw user ID string from the JWT <c>sub</c> claim.
    /// Used internally by middleware; consumers should use <see cref="UserId"/>.
    /// </summary>
    public string? UserIdRaw { get; set; }

    /// <inheritdoc/>
    public Guid? UserId =>
        Guid.TryParse(UserIdRaw, out var g) ? g : null;

    /// <inheritdoc/>
    public string? Email { get; set; }

    /// <inheritdoc/>
    public string? Username { get; set; }

    #endregion

    #region Agent Organization

    /// <inheritdoc/>
    public Guid? AgentOrgId { get; set; }

    /// <inheritdoc/>
    public string? AgentOrgName { get; set; }

    /// <inheritdoc/>
    public OrgType? AgentOrgType { get; set; }

    /// <inheritdoc/>
    public string? AgentOrgRole { get; set; }

    #endregion

    #region Target Organization

    /// <inheritdoc/>
    public Guid? TargetOrgId { get; set; }

    /// <inheritdoc/>
    public string? TargetOrgName { get; set; }

    /// <inheritdoc/>
    public OrgType? TargetOrgType { get; set; }

    /// <inheritdoc/>
    public string? TargetOrgRole { get; set; }

    #endregion

    #region Org Emulation

    /// <inheritdoc/>
    public bool IsOrgEmulating { get; set; }

    #endregion

    #region User Impersonation

    /// <inheritdoc/>
    public Guid? ImpersonatedBy { get; set; }

    /// <inheritdoc/>
    public string? ImpersonatingEmail { get; set; }

    /// <inheritdoc/>
    public string? ImpersonatingUsername { get; set; }

    /// <inheritdoc/>
    public bool IsUserImpersonating { get; set; }

    #endregion

    #region Network / Enrichment

    /// <inheritdoc/>
    public string? ClientIp { get; init; }

    /// <inheritdoc/>
    public string? ServerFingerprint { get; init; }

    /// <inheritdoc/>
    public string? ClientFingerprint { get; init; }

    /// <inheritdoc/>
    public string? DeviceFingerprint { get; init; }

    /// <inheritdoc/>
    public string? WhoIsHashId { get; init; }

    /// <inheritdoc/>
    public string? City { get; init; }

    /// <inheritdoc/>
    public string? CountryCode { get; init; }

    /// <inheritdoc/>
    public string? SubdivisionCode { get; init; }

    /// <inheritdoc/>
    public bool? IsVpn { get; init; }

    /// <inheritdoc/>
    public bool? IsProxy { get; init; }

    /// <inheritdoc/>
    public bool? IsTor { get; init; }

    /// <inheritdoc/>
    public bool? IsHosting { get; init; }

    #endregion

    #region Trust

    /// <inheritdoc/>
    public bool IsTrustedService { get; set; }

    #endregion

    #region Helpers

    /// <inheritdoc/>
    public bool IsAgentStaff =>
        AgentOrgType is OrgType.Support or OrgType.Admin;

    /// <inheritdoc/>
    public bool IsAgentAdmin =>
        AgentOrgType is OrgType.Admin;

    /// <inheritdoc/>
    public bool IsTargetingStaff =>
        TargetOrgType is OrgType.Support or OrgType.Admin;

    /// <inheritdoc/>
    public bool IsTargetingAdmin =>
        TargetOrgType is OrgType.Admin;

    #endregion
}
