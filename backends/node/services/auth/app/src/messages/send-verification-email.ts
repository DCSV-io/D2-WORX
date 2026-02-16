/** Message published when a verification email needs to be sent. */
export interface SendVerificationEmail {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly verificationUrl: string;
  readonly token: string;
}
