/**
 * Represents the relationship type between a user and an organization.
 * Mirrors D2.Shared.Handler.UserToOrgRelationship in .NET.
 */
export enum UserToOrgRelationship {
  DirectMember = "DirectMember",
  AssociatedMember = "AssociatedMember",
  Emulation = "Emulation",
}
