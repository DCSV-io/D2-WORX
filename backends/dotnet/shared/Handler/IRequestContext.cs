// -----------------------------------------------------------------------
// <copyright file="IRequestContext.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Handler;

/// <summary>
/// Represents the context of a request, including tracing information, user identity,
/// and organizational details.
/// </summary>
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
    /// Gets a value indicating whether indicates whether the user is authenticated.
    /// </summary>
    bool IsAuthenticated { get; }

    /// <summary>
    /// Gets the unique identifier of the user, if applicable.
    /// </summary>
    Guid? UserId { get; }

    /// <summary>
    /// Gets the username of the user, if applicable.
    /// </summary>
    string? Username { get; }

    #endregion

    #region Agent Organization

    /// <summary>
    /// Gets the unique identifier of the agent organization, if applicable.
    /// </summary>
    Guid? AgentOrgId { get; }

    /// <summary>
    /// Gets the name of the agent organization, if applicable.
    /// </summary>
    string? AgentOrgName { get; }

    /// <summary>
    /// Gets the type of the agent organization, if applicable.
    /// </summary>
    OrgType? AgentOrgType { get; }

    #endregion

    #region Target Organization

    /// <summary>
    /// Gets the unique identifier of the target organization, if applicable.
    /// </summary>
    Guid? TargetOrgId { get; }

    /// <summary>
    /// Gets the name of the target organization, if applicable.
    /// </summary>
    string? TargetOrgName { get; }

    /// <summary>
    /// Gets the type of the target organization, if applicable.
    /// </summary>
    OrgType? TargetOrgType { get; }

    #endregion

    #region Helpers

    /// <summary>
    /// Gets the relationship between the user and the target organization.
    /// </summary>
    public UserToOrgRelationship? UserToTargetRelationship { get; }

    /// <summary>
    /// Gets a value indicating whether indicates whether the agent organization is of type
    /// <see cref="OrgType.Support"/> or <see cref="OrgType.Admin"/>.
    /// </summary>
    public bool IsAgentStaff { get; }

    /// <summary>
    /// Gets a value indicating whether indicates whether the agent organization is of type
    /// <see cref="OrgType.Admin"/>.</summary>
    public bool IsAgentAdmin { get; }

    /// <summary>
    /// Gets a value indicating whether indicates whether the target organization is of type
    /// <see cref="OrgType.Support"/> or <see cref="OrgType.Admin"/>.
    /// </summary>
    public bool IsTargetingStaff { get; }

    /// <summary>
    /// Gets a value indicating whether indicates whether the target organization is of type
    /// <see cref="OrgType.Admin"/>.
    /// </summary>
    public bool IsTargetingAdmin { get; }

    #endregion
}
