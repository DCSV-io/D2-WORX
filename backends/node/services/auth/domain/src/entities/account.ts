/**
 * Represents a user's authentication account (e.g., credential, Google, GitHub).
 *
 * BetterAuth-managed — no factory function. This interface is the read contract only.
 * Password is deliberately excluded (infra detail that must never leave auth-infra).
 */
export interface Account {
  readonly id: string;
  readonly userId: string;
  readonly providerId: string;
  readonly accountId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
