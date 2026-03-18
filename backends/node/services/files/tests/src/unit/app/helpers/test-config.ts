import type { ContextKeyConfig, ContextKeyConfigMap } from "@d2/files-app";

export const TEST_USER_AVATAR_CONFIG: ContextKeyConfig = {
  contextKey: "user_avatar",
  uploadResolution: "jwt_owner",
  readResolution: "jwt_owner",
  onProcessedUrl: "http://auth:3100/callbacks/file-processed",
  allowedCategories: ["image"],
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB
  variants: [
    { name: "thumb", maxDimension: 64 },
    { name: "small", maxDimension: 128 },
    { name: "medium", maxDimension: 256 },
    { name: "original" },
  ],
};

export const TEST_ORG_LOGO_CONFIG: ContextKeyConfig = {
  contextKey: "org_logo",
  uploadResolution: "jwt_org",
  readResolution: "jwt_org",
  onProcessedUrl: "http://auth:3100/callbacks/file-processed",
  allowedCategories: ["image"],
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
  variants: [
    { name: "thumb", maxDimension: 64 },
    { name: "medium", maxDimension: 512 },
    { name: "original" },
  ],
};

export const TEST_THREAD_ATTACHMENT_CONFIG: ContextKeyConfig = {
  contextKey: "thread_attachment",
  uploadResolution: "callback",
  readResolution: "authenticated",
  accessCheckUrl: "http://comms:3200/callbacks/can-access",
  onProcessedUrl: "http://comms:3200/callbacks/file-processed",
  allowedCategories: ["image", "document", "video", "audio"],
  maxSizeBytes: 25 * 1024 * 1024, // 25 MB
  variants: [
    { name: "thumb", maxDimension: 150 },
    { name: "preview", maxDimension: 800 },
    { name: "original" },
  ],
};

export function createTestConfigMap(...configs: ContextKeyConfig[]): ContextKeyConfigMap {
  const map = new Map<string, ContextKeyConfig>();
  for (const config of configs) {
    map.set(config.contextKey, config);
  }
  return map;
}

export const TEST_CONFIG_MAP: ContextKeyConfigMap = createTestConfigMap(
  TEST_USER_AVATAR_CONFIG,
  TEST_ORG_LOGO_CONFIG,
  TEST_THREAD_ATTACHMENT_CONFIG,
);
