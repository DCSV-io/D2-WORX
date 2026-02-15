import type { EmulationConsent } from "@d2/auth-domain";

/**
 * Repository interface for emulation consent records.
 *
 * Implemented by Kysely-backed repository in auth-infra.
 * Structural typing ensures compatibility without direct import.
 */
export interface IEmulationConsentRepository {
  create(consent: EmulationConsent): Promise<void>;
  findById(id: string): Promise<EmulationConsent | undefined>;
  findActiveByUserId(userId: string, limit?: number, offset?: number): Promise<EmulationConsent[]>;
  findActiveByUserIdAndOrg(userId: string, grantedToOrgId: string): Promise<EmulationConsent | null>;
  revoke(id: string): Promise<void>;
}
