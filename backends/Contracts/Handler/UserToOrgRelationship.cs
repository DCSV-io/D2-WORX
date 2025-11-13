namespace D2.Contracts.Handler;

/// <summary>
/// Represents the relationship type between a user and an organization during a session or request.
/// </summary>
public enum UserToOrgRelationship
{
    /// <summary>
    /// This user is a direct member of the organization.
    /// </summary>
    DirectMember,

    /// <summary>
    /// This user is associated with the organization through another entity, such as an affiliate
    /// or partner.
    /// </summary>
    AssociatedMember,

    /// <summary>
    /// This user is accessing the organization in an emulation or impersonation capacity.
    /// </summary>
    Emulation
}
