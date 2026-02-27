/**
 * Centralized cache key definitions for the Geo client library.
 * All cache keys used by geo-client handlers are defined here.
 */
export const GEO_CACHE_KEYS = {
  /** GeoRefData blob (in-memory + distributed). */
  REFDATA: "geo:refdata",

  /** Single contact by ID. Format: `geo:contact:{contactId}` */
  contact: (id: string) => `geo:contact:${id}`,

  /** Contacts by external key pair. Format: `geo:contacts-by-extkey:{contextKey}:{relatedEntityId}` */
  contactsByExtKey: (contextKey: string, relatedEntityId: string) =>
    `geo:contacts-by-extkey:${contextKey}:${relatedEntityId}`,

  /** WhoIs lookup by IP + fingerprint. Format: `geo:whois:{ip}:{fingerprint}` */
  whois: (ip: string, fingerprint: string) => `geo:whois:${ip}:${fingerprint}`,
} as const;
