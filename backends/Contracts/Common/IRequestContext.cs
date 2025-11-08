namespace D2.Contracts.Common;

/// <summary>
/// Represents the context of a request, including tracing information, user identity,
/// and organizational details.
/// </summary>
public interface IRequestContext
{
    #region Tracing

    /// <summary>
    /// The trace identifier for the request.
    /// </summary>
    string? TraceId { get; }

    /// <summary>
    /// The unique request identifier.
    /// </summary>
    string? RequestId { get; }

    /// <summary>
    /// The path of the request.
    /// </summary>
    string? RequestPath { get; }

    #endregion

    #region User / Identity

    /// <summary>
    /// Indicates whether the user is authenticated.
    /// </summary>
    bool IsAuthenticated { get; }

    /// <summary>
    /// The unique identifier of the user, if applicable.
    /// </summary>
    Guid? UserId { get; }

    /// <summary>
    /// The username of the user, if applicable.
    /// </summary>
    string? Username { get; }

    #endregion

    #region Agent Organization

    /// <summary>
    /// The unique identifier of the agent organization, if applicable.
    /// </summary>
    Guid? AgentOrgId { get; }

    /// <summary>
    /// The name of the agent organization, if applicable.
    /// </summary>
    string? AgentOrgName { get; }

    /// <summary>
    /// The type of the agent organization, if applicable.
    /// </summary>
    OrgType? AgentOrgType { get; }

    #endregion

    #region Target Organization

    /// <summary>
    /// The unique identifier of the target organization, if applicable.
    /// </summary>
    Guid? TargetOrgId { get; }

    /// <summary>
    /// The name of the target organization, if applicable.
    /// </summary>
    string? TargetOrgName { get; }

    /// <summary>
    /// The type of the target organization, if applicable.
    /// </summary>
    OrgType? TargetOrgType { get; }

    #endregion

    #region Helpers

    /// <summary>
    /// The relationship between the user and the target organization.
    /// </summary>
    public UserToOrgRelationship? UserToTargetRelationship { get; }

    /// <summary>
    /// Indicates whether the agent organization is of type <see cref="OrgType.Support"/> or
    /// <see cref="OrgType.Admin"/>.
    /// </summary>
    public bool IsAgentStaff { get; }

    /// <summary>
    /// Indicates whether the agent organization is of type <see cref="OrgType.Admin"/>.
    /// </summary>
    public bool IsAgentAdmin { get; }

    /// <summary>
    /// Indicates whether the target organization is of type <see cref="OrgType.Support"/> or
    /// <see cref="OrgType.Admin"/>.
    /// </summary>
    public bool IsTargetingStaff { get; }

    /// <summary>
    /// Indicates whether the target organization is of type <see cref="OrgType.Admin"/>.
    /// </summary>
    public bool IsTargetingAdmin { get; }

    #endregion
}
