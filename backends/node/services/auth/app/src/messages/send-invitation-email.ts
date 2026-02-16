/** Message published when an organization invitation email needs to be sent. */
export interface SendInvitationEmail {
  readonly invitationId: string;
  readonly inviteeEmail: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly role: string;
  readonly inviterName: string;
  readonly inviterEmail: string;
  readonly invitationUrl: string;
}
