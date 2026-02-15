import type { SignInEvent } from "@d2/auth-domain";

/**
 * Repository interface for sign-in event records.
 *
 * Implemented by Kysely-backed repository in auth-infra.
 * Structural typing ensures compatibility without direct import.
 */
export interface ISignInEventRepository {
  create(event: SignInEvent): Promise<void>;
  findByUserId(userId: string, limit: number, offset: number): Promise<SignInEvent[]>;
  countByUserId(userId: string): Promise<number>;
  /** Returns the created_at of the most recent event for a user, or null if none. */
  getLatestEventDate(userId: string): Promise<Date | null>;
}
