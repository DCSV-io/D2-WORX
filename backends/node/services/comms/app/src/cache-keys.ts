/**
 * Centralized cache key definitions for the Comms application layer.
 */
export const COMMS_CACHE_KEYS = {
  /** Channel preference for a contact. Format: `comms:channel-pref:{contactId}` */
  channelPref: (contactId: string) => `comms:channel-pref:${contactId}`,
} as const;
