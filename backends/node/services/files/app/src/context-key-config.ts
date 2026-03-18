import type { ContentCategory } from "@d2/files-domain";
import type { VariantConfig } from "@d2/files-domain";

/**
 * Access resolution strategy for upload operations.
 *
 * - `jwt_owner` — requestContext.userId must match relatedEntityId
 * - `jwt_org` — requestContext.orgId must match relatedEntityId
 * - `callback` — external gRPC access check via accessCheckUrl
 */
export type UploadResolution = "jwt_owner" | "jwt_org" | "callback";

/**
 * Access resolution strategy for read operations.
 *
 * - `jwt_owner` — requestContext.userId must match relatedEntityId
 * - `jwt_org` — requestContext.orgId must match relatedEntityId
 * - `authenticated` — any authenticated user can read
 * - `callback` — external gRPC access check via accessCheckUrl
 */
export type ReadResolution = "jwt_owner" | "jwt_org" | "authenticated" | "callback";

/**
 * Per-context-key runtime configuration for the Files service.
 *
 * Parsed from indexed env vars at startup. Defines access control,
 * allowed content categories, size limits, callback URLs, and variant definitions.
 */
export interface ContextKeyConfig {
  readonly contextKey: string;
  readonly uploadResolution: UploadResolution;
  readonly readResolution: ReadResolution;
  readonly accessCheckUrl?: string;
  readonly onProcessedUrl: string;
  readonly allowedCategories: readonly ContentCategory[];
  readonly maxSizeBytes: number;
  readonly variants: readonly VariantConfig[];
}

/**
 * Immutable map of contextKey → ContextKeyConfig.
 * Populated once at startup, injected into handlers via DI.
 */
export type ContextKeyConfigMap = ReadonlyMap<string, ContextKeyConfig>;

const VALID_UPLOAD_RESOLUTIONS: readonly string[] = ["jwt_owner", "jwt_org", "callback"];
const VALID_READ_RESOLUTIONS: readonly string[] = [
  "jwt_owner",
  "jwt_org",
  "authenticated",
  "callback",
];
const VALID_CATEGORIES: readonly string[] = ["image", "document", "video", "audio"];

/**
 * Parses indexed environment variables into a ContextKeyConfigMap.
 *
 * Env var convention (fully indexed):
 * ```
 * FILES_CK__0__KEY=user_avatar
 * FILES_CK__0__UPLOAD_RESOLUTION=jwt_owner
 * FILES_CK__0__READ_RESOLUTION=jwt_owner
 * FILES_CK__0__ON_PROCESSED_URL=http://auth:3100/callbacks/file-processed
 * FILES_CK__0__CATEGORY__0=image
 * FILES_CK__0__MAX_SIZE_BYTES=5242880
 * FILES_CK__0__VARIANT__0__NAME=thumb
 * FILES_CK__0__VARIANT__0__MAX_DIM=64
 * FILES_CK__0__VARIANT__1__NAME=original
 * ```
 *
 * @throws Error on invalid or incomplete config (fail-fast at startup)
 */
export function parseContextKeyConfigs(
  env: Record<string, string | undefined>,
): ContextKeyConfigMap {
  const map = new Map<string, ContextKeyConfig>();
  const prefix = "FILES_CK";

  for (let i = 0; ; i++) {
    const key = env[`${prefix}__${i}__KEY`];
    if (key === undefined) break;

    const uploadResolution = env[`${prefix}__${i}__UPLOAD_RESOLUTION`];
    const readResolution = env[`${prefix}__${i}__READ_RESOLUTION`];
    const accessCheckUrl = env[`${prefix}__${i}__ACCESS_CHECK_URL`];
    const onProcessedUrl = env[`${prefix}__${i}__ON_PROCESSED_URL`];
    const maxSizeBytesRaw = env[`${prefix}__${i}__MAX_SIZE_BYTES`];

    if (!key.trim()) {
      throw new Error(`FILES_CK__${i}__KEY is empty.`);
    }

    if (!uploadResolution || !VALID_UPLOAD_RESOLUTIONS.includes(uploadResolution)) {
      throw new Error(
        `FILES_CK__${i}__UPLOAD_RESOLUTION must be one of: ${VALID_UPLOAD_RESOLUTIONS.join(", ")}. Got: '${uploadResolution}'.`,
      );
    }

    if (!readResolution || !VALID_READ_RESOLUTIONS.includes(readResolution)) {
      throw new Error(
        `FILES_CK__${i}__READ_RESOLUTION must be one of: ${VALID_READ_RESOLUTIONS.join(", ")}. Got: '${readResolution}'.`,
      );
    }

    if (
      (uploadResolution === "callback" || readResolution === "callback") &&
      !accessCheckUrl?.trim()
    ) {
      throw new Error(
        `FILES_CK__${i}__ACCESS_CHECK_URL is required when either resolution is 'callback'.`,
      );
    }

    if (!onProcessedUrl?.trim()) {
      throw new Error(`FILES_CK__${i}__ON_PROCESSED_URL is required.`);
    }

    // Parse indexed categories: FILES_CK__i__CATEGORY__j
    const allowedCategories: string[] = [];
    for (let j = 0; ; j++) {
      const cat = env[`${prefix}__${i}__CATEGORY__${j}`];
      if (cat === undefined) break;
      const trimmed = cat.trim();
      if (!VALID_CATEGORIES.includes(trimmed)) {
        throw new Error(
          `FILES_CK__${i}__CATEGORY__${j} contains invalid category '${trimmed}'. Valid: ${VALID_CATEGORIES.join(", ")}.`,
        );
      }
      allowedCategories.push(trimmed);
    }

    if (allowedCategories.length === 0) {
      throw new Error(`FILES_CK__${i} must have at least one CATEGORY.`);
    }

    if (!maxSizeBytesRaw?.trim()) {
      throw new Error(`FILES_CK__${i}__MAX_SIZE_BYTES is required.`);
    }

    const maxSizeBytes = Number(maxSizeBytesRaw);
    if (!Number.isFinite(maxSizeBytes) || maxSizeBytes <= 0) {
      throw new Error(
        `FILES_CK__${i}__MAX_SIZE_BYTES must be a positive number. Got: '${maxSizeBytesRaw}'.`,
      );
    }

    // Parse indexed variants: FILES_CK__i__VARIANT__j__NAME, optional __MAX_DIM
    const variants: VariantConfig[] = [];
    for (let j = 0; ; j++) {
      const name = env[`${prefix}__${i}__VARIANT__${j}__NAME`];
      if (name === undefined) break;

      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error(`FILES_CK__${i}__VARIANT__${j}__NAME is empty.`);
      }

      const maxDimRaw = env[`${prefix}__${i}__VARIANT__${j}__MAX_DIM`];
      let maxDimension: number | undefined;

      if (maxDimRaw !== undefined) {
        maxDimension = Number(maxDimRaw);
        if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
          throw new Error(
            `FILES_CK__${i}__VARIANT__${j}__MAX_DIM must be a positive number. Got: '${maxDimRaw}'.`,
          );
        }
      }

      variants.push(
        maxDimension !== undefined ? { name: trimmedName, maxDimension } : { name: trimmedName },
      );
    }

    if (variants.length === 0) {
      throw new Error(`FILES_CK__${i} must have at least one VARIANT.`);
    }

    if (map.has(key)) {
      throw new Error(`Duplicate context key '${key}' at index ${i}.`);
    }

    map.set(key, {
      contextKey: key,
      uploadResolution: uploadResolution as UploadResolution,
      readResolution: readResolution as ReadResolution,
      accessCheckUrl: accessCheckUrl?.trim() || undefined,
      onProcessedUrl: onProcessedUrl.trim(),
      allowedCategories: allowedCategories as ContentCategory[],
      maxSizeBytes,
      variants,
    });
  }

  return map;
}
