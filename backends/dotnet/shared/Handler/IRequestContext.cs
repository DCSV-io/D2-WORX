// -----------------------------------------------------------------------
// <copyright file="IRequestContext.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Handler;

/// <summary>
/// Represents the context of a request, including tracing information, user identity,
/// and organizational details.
/// </summary>
/// <remarks>
/// <para>
/// <b>Agent org</b> = the user's actual org membership. Only changes during
/// <b>user impersonation</b> (admin acting as another user).
/// </para>
/// <para>
/// <b>Target org</b> = the org all operations execute against. Always populated for
/// authenticated users. Equals the emulated org during <b>org emulation</b>,
/// otherwise equals the agent org.
/// </para>
/// <para>
/// Downstream logic should always use target org fields for authorization and data scoping.
/// Agent org fields are for audit/identity context only.
/// </para>
/// </remarks>
public interface IRequestContext
{
    #region Tracing

    /// <summary>
    /// Gets the trace identifier for the request.
    /// </summary>
    string? TraceId { get; }

    /// <summary>
    /// Gets the unique request identifier.
    /// </summary>
    string? RequestId { get; }

    /// <summary>
    /// Gets the path of the request.
    /// </summary>
    string? RequestPath { get; }

    #endregion

    #region User / Identity

    /// <summary>
    /// Gets a value indicating whether the user is authenticated.
    /// </summary>
    bool IsAuthenticated { get; }

    /// <summary>
    /// Gets the unique identifier of the user.
    /// During user impersonation, this is the impersonated user's ID.
    /// </summary>
    Guid? UserId { get; }

    /// <summary>
    /// Gets the user's email address.
    /// </summary>
    string? Email { get; }

    /// <summary>
    /// Gets the user's login handle (unique, lowercase).
    /// </summary>
    string? Username { get; }

    #endregion

    #region Agent Organization

    /// <summary>
    /// Gets the unique identifier of the agent organization (user's actual org membership).
    /// Only changes during user impersonation.
    /// </summary>
    Guid? AgentOrgId { get; }

    /// <summary>
    /// Gets the name of the agent organization.
    /// </summary>
    string? AgentOrgName { get; }

    /// <summary>
    /// Gets the type of the agent organization.
    /// </summary>
    OrgType? AgentOrgType { get; }

    /// <summary>
    /// Gets the role of the user in the agent organization (e.g., "owner", "admin", "member").
    /// </summary>
    string? AgentOrgRole { get; }

    #endregion

    #region Target Organization

    /// <summary>
    /// Gets the unique identifier of the target organization (the org operations execute against).
    /// Always populated for authenticated users with org context.
    /// Equals the emulated org during org emulation, otherwise equals the agent org.
    /// </summary>
    Guid? TargetOrgId { get; }

    /// <summary>
    /// Gets the name of the target organization.
    /// </summary>
    string? TargetOrgName { get; }

    /// <summary>
    /// Gets the type of the target organization.
    /// </summary>
    OrgType? TargetOrgType { get; }

    /// <summary>
    /// Gets the role of the user in the target organization.
    /// During org emulation, this is always "auditor".
    /// </summary>
    string? TargetOrgRole { get; }

    #endregion

    #region Org Emulation

    /// <summary>
    /// Gets a value indicating whether org emulation is active.
    /// When true, a staff user is viewing another org as read-only.
    /// All CUD operations should be blocked during org emulation.
    /// </summary>
    bool IsOrgEmulating { get; }

    #endregion

    #region User Impersonation

    /// <summary>
    /// Gets the user ID of the admin who initiated user impersonation.
    /// Present when a support/admin user is acting as another user.
    /// </summary>
    Guid? ImpersonatedBy { get; }

    /// <summary>
    /// Gets the impersonator's email address (present during user impersonation).
    /// </summary>
    string? ImpersonatingEmail { get; }

    /// <summary>
    /// Gets the impersonator's username (present during user impersonation).
    /// </summary>
    string? ImpersonatingUsername { get; }

    /// <summary>
    /// Gets a value indicating whether user impersonation is active.
    /// When true, <see cref="UserId"/> is the impersonated user and
    /// <see cref="ImpersonatedBy"/> is the admin who initiated it.
    /// Sensitive operations (payments, etc.) should be blocked during user impersonation.
    /// </summary>
    bool IsUserImpersonating { get; }

    #endregion

    #region Network / Enrichment

    /// <summary>
    /// Gets the resolved client IP address.
    /// </summary>
    string? ClientIp { get; }

    /// <summary>
    /// Gets the server-computed fingerprint based on request headers.
    /// </summary>
    string? ServerFingerprint { get; }

    /// <summary>
    /// Gets the client-provided fingerprint from the d2-cfp cookie or X-Client-Fingerprint header.
    /// </summary>
    string? ClientFingerprint { get; }

    /// <summary>
    /// Gets the combined device fingerprint: SHA-256(clientFP + serverFP + clientIp).
    /// </summary>
    string? DeviceFingerprint { get; }

    /// <summary>
    /// Gets the WhoIs hash ID for downstream lookups.
    /// </summary>
    string? WhoIsHashId { get; }

    /// <summary>
    /// Gets the city name from WhoIs data.
    /// </summary>
    string? City { get; }

    /// <summary>
    /// Gets the ISO 3166-1 alpha-2 country code from WhoIs data.
    /// </summary>
    string? CountryCode { get; }

    /// <summary>
    /// Gets the ISO 3166-2 subdivision code from WhoIs data.
    /// </summary>
    string? SubdivisionCode { get; }

    /// <summary>
    /// Gets a value indicating whether the IP is from a VPN.
    /// </summary>
    bool? IsVpn { get; }

    /// <summary>
    /// Gets a value indicating whether the IP is from a proxy.
    /// </summary>
    bool? IsProxy { get; }

    /// <summary>
    /// Gets a value indicating whether the IP is from a Tor exit node.
    /// </summary>
    bool? IsTor { get; }

    /// <summary>
    /// Gets a value indicating whether the IP is from a hosting provider.
    /// </summary>
    bool? IsHosting { get; }

    #endregion

    #region Trust

    /// <summary>
    /// Gets a value indicating whether the request is from a trusted service.
    /// </summary>
    bool IsTrustedService { get; }

    #endregion

    #region Helpers

    /// <summary>
    /// Gets a value indicating whether the agent organization is of type
    /// <see cref="OrgType.Support"/> or <see cref="OrgType.Admin"/>.
    /// </summary>
    bool IsAgentStaff { get; }

    /// <summary>
    /// Gets a value indicating whether the agent organization is of type
    /// <see cref="OrgType.Admin"/>.
    /// </summary>
    bool IsAgentAdmin { get; }

    /// <summary>
    /// Gets a value indicating whether the target organization is of type
    /// <see cref="OrgType.Support"/> or <see cref="OrgType.Admin"/>.
    /// </summary>
    bool IsTargetingStaff { get; }

    /// <summary>
    /// Gets a value indicating whether the target organization is of type
    /// <see cref="OrgType.Admin"/>.
    /// </summary>
    bool IsTargetingAdmin { get; }

    #endregion
}
