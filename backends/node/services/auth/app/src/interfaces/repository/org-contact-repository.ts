import type { OrgContact } from "@d2/auth-domain";

/**
 * Repository interface for org contact junction records.
 *
 * Implemented by Drizzle-backed repository in auth-infra.
 * Structural typing ensures compatibility without direct import.
 */
export interface IOrgContactRepository {
  create(contact: OrgContact): Promise<void>;
  findById(id: string): Promise<OrgContact | undefined>;
  findByOrgId(organizationId: string, limit?: number, offset?: number): Promise<OrgContact[]>;
  update(contact: OrgContact): Promise<void>;
  delete(id: string): Promise<void>;
}
