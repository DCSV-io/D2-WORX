// -----------------------------------------------------------------------
// <copyright file="RequestContext.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Handler.Extensions;

using System.Diagnostics;
using System.Security.Claims;
using D2.Shared.Handler.Auth;
using Microsoft.AspNetCore.Http;

/// <summary>
/// Implementation of <see cref="IRequestContext"/> that extracts request context
/// from the current HTTP context including tracing, identity, and organization information.
/// </summary>
/// <remarks>
/// <para>
/// Target org is always derived from JWT claims: emulated org if org emulation is active,
/// otherwise the agent org. No request headers are used for target org resolution.
/// </para>
/// </remarks>
public class RequestContext : IRequestContext
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RequestContext"/> class.
    /// </summary>
    ///
    /// <param name="httpContextAccessor">
    /// The HTTP context accessor for retrieving the current request context.
    /// </param>
    public RequestContext(IHttpContextAccessor httpContextAccessor)
    {
        var ctx = httpContextAccessor.HttpContext;

        // Tracing.
        TraceId = Activity.Current?.TraceId.ToString();
        RequestId = ctx?.TraceIdentifier;
        RequestPath = ctx?.Request.Path.Value;

        // User / Identity — extracted from JWT claims.
        IsAuthenticated = ctx?.User.Identity?.IsAuthenticated ?? false;
        UserId = GetGuidClaim(ctx, JwtClaimTypes.SUB);
        Email = GetStringClaim(ctx, JwtClaimTypes.EMAIL);
        Username = GetStringClaim(ctx, JwtClaimTypes.USERNAME);

        // Agent Organization — the user's actual org membership.
        AgentOrgId = GetGuidClaim(ctx, JwtClaimTypes.ORG_ID);
        AgentOrgName = GetStringClaim(ctx, JwtClaimTypes.ORG_NAME);
        AgentOrgType = GetOrgTypeClaim(ctx, JwtClaimTypes.ORG_TYPE);

        // Org Emulation — staff viewing another org as read-only.
        IsOrgEmulating = string.Equals(
            GetStringClaim(ctx, JwtClaimTypes.IS_EMULATING),
            "true",
            StringComparison.OrdinalIgnoreCase);

        // Target Organization — the org all operations execute against.
        // Emulated org during org emulation, otherwise agent org.
        if (IsOrgEmulating)
        {
            TargetOrgId = GetGuidClaim(ctx, JwtClaimTypes.EMULATED_ORG_ID) ?? AgentOrgId;
            TargetOrgName = GetStringClaim(ctx, JwtClaimTypes.EMULATED_ORG_NAME) ?? AgentOrgName;
            TargetOrgType = GetOrgTypeClaim(ctx, JwtClaimTypes.EMULATED_ORG_TYPE) ?? AgentOrgType;
        }
        else
        {
            TargetOrgId = AgentOrgId;
            TargetOrgName = AgentOrgName;
            TargetOrgType = AgentOrgType;
        }

        // User Impersonation — admin acting as another user.
        ImpersonatedBy = GetGuidClaim(ctx, JwtClaimTypes.IMPERSONATED_BY);
        ImpersonatingEmail = GetStringClaim(ctx, JwtClaimTypes.IMPERSONATING_EMAIL);
        ImpersonatingUsername = GetStringClaim(ctx, JwtClaimTypes.IMPERSONATING_USERNAME);
        IsUserImpersonating = string.Equals(
            GetStringClaim(ctx, JwtClaimTypes.IS_IMPERSONATING),
            "true",
            StringComparison.OrdinalIgnoreCase);
    }

    #region Tracing

    /// <inheritdoc/>
    public string? TraceId { get; }

    /// <inheritdoc/>
    public string? RequestId { get; }

    /// <inheritdoc/>
    public string? RequestPath { get; }

    #endregion

    #region User / Identity

    /// <inheritdoc/>
    public bool IsAuthenticated { get; }

    /// <inheritdoc/>
    public Guid? UserId { get; }

    /// <inheritdoc/>
    public string? Email { get; }

    /// <inheritdoc/>
    public string? Username { get; }

    #endregion

    #region Agent Organization

    /// <inheritdoc/>
    public Guid? AgentOrgId { get; }

    /// <inheritdoc/>
    public string? AgentOrgName { get; }

    /// <inheritdoc/>
    public OrgType? AgentOrgType { get; }

    #endregion

    #region Target Organization

    /// <inheritdoc/>
    public Guid? TargetOrgId { get; }

    /// <inheritdoc/>
    public string? TargetOrgName { get; }

    /// <inheritdoc/>
    public OrgType? TargetOrgType { get; }

    #endregion

    #region Org Emulation

    /// <inheritdoc/>
    public bool IsOrgEmulating { get; }

    #endregion

    #region User Impersonation

    /// <inheritdoc/>
    public Guid? ImpersonatedBy { get; }

    /// <inheritdoc/>
    public string? ImpersonatingEmail { get; }

    /// <inheritdoc/>
    public string? ImpersonatingUsername { get; }

    /// <inheritdoc/>
    public bool IsUserImpersonating { get; }

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

    #region Claim Extraction Helpers

    /// <summary>
    /// Extracts a string claim value from the authenticated user principal.
    /// </summary>
    private static string? GetStringClaim(HttpContext? ctx, string claimType)
    {
        var value = ctx?.User.FindFirst(claimType)?.Value;
        return string.IsNullOrEmpty(value) ? null : value;
    }

    /// <summary>
    /// Extracts a Guid claim value from the authenticated user principal.
    /// </summary>
    private static Guid? GetGuidClaim(HttpContext? ctx, string claimType)
    {
        var value = ctx?.User.FindFirst(claimType)?.Value;
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        return Guid.TryParse(value, out var guid) ? guid : null;
    }

    /// <summary>
    /// Extracts an OrgType claim value from the authenticated user principal.
    /// Maps Node.js org type strings (lowercase) to .NET <see cref="OrgType"/> enum values.
    /// </summary>
    private static OrgType? GetOrgTypeClaim(HttpContext? ctx, string claimType)
    {
        var value = ctx?.User.FindFirst(claimType)?.Value;
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        // Node.js auth service uses lowercase string values: admin, support, affiliate, customer, third_party.
        // Map to .NET OrgType enum.
        return value.ToLowerInvariant() switch
        {
            OrgTypeValues.ADMIN => OrgType.Admin,
            OrgTypeValues.SUPPORT => OrgType.Support,
            OrgTypeValues.AFFILIATE => OrgType.Affiliate,
            OrgTypeValues.CUSTOMER => OrgType.Customer,
            OrgTypeValues.THIRD_PARTY => OrgType.ThirdParty,
            _ => Enum.TryParse<OrgType>(value, ignoreCase: true, out var parsed) ? parsed : null,
        };
    }

    #endregion
}
