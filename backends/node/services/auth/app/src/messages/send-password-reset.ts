/** Message published when a password reset email needs to be sent. */
export interface SendPasswordReset {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly resetUrl: string;
  readonly token: string;
}
