/**
 * Commonly used constant values.
 * Mirrors D2.Shared.Utilities.Constants.Constants in .NET.
 */

/** Prefix for all distributed cache keys. */
export const DIST_CACHE_KEY_PREFIX = "d2:";

/** Distributed cache key prefix for geo data. */
export const DIST_CACHE_KEY_GEO = `${DIST_CACHE_KEY_PREFIX}geo:`;

/** Distributed cache key for georeference data. */
export const DIST_CACHE_KEY_GEO_REF_DATA = `${DIST_CACHE_KEY_GEO}refdata`;

/** File name for persisted georeference data (protobuf binary). */
export const GEO_REF_DATA_FILE_NAME = "georefdata.bin";
