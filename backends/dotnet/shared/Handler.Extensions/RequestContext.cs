// -----------------------------------------------------------------------
// <copyright file="RequestContext.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Handler.Extensions;

using System.Diagnostics;
using Microsoft.AspNetCore.Http;

/// <summary>
/// Implementation of <see cref="IRequestContext"/> that extracts request context
/// from the current HTTP context including tracing, identity, and organization information.
/// </summary>
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

        // User / Identity - defaults for unauthenticated requests.
        // TODO: Extract from JWT claims when auth is implemented.
        IsAuthenticated = ctx?.User.Identity?.IsAuthenticated ?? false;
        UserId = null;
        Username = null;

        // Agent Organization - defaults for unauthenticated requests.
        // TODO: Extract from JWT claims when auth is implemented.
        AgentOrgId = null;
        AgentOrgName = null;
        AgentOrgType = null;

        // Target Organization - defaults for unauthenticated requests.
        // TODO: Extract from JWT claims or request headers when auth is implemented.
        TargetOrgId = null;
        TargetOrgName = null;
        TargetOrgType = null;

        // Relationship - default for unauthenticated requests.
        // TODO: Compute from claims when auth is implemented.
        UserToTargetRelationship = null;
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

    #region Helpers

    /// <inheritdoc/>
    public UserToOrgRelationship? UserToTargetRelationship { get; }

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
