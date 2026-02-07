import { describe, it, expect } from "vitest";
import {
  DIST_CACHE_KEY_PREFIX,
  DIST_CACHE_KEY_GEO,
  DIST_CACHE_KEY_GEO_REF_DATA,
} from "@d2/utilities";

describe("Cache key constants", () => {
  it("DIST_CACHE_KEY_PREFIX is d2:", () => {
    expect(DIST_CACHE_KEY_PREFIX).toBe("d2:");
  });

  it("DIST_CACHE_KEY_GEO starts with prefix", () => {
    expect(DIST_CACHE_KEY_GEO).toBe("d2:geo:");
    expect(DIST_CACHE_KEY_GEO.startsWith(DIST_CACHE_KEY_PREFIX)).toBe(true);
  });

  it("DIST_CACHE_KEY_GEO_REF_DATA starts with geo prefix", () => {
    expect(DIST_CACHE_KEY_GEO_REF_DATA).toBe("d2:geo:refdata");
    expect(DIST_CACHE_KEY_GEO_REF_DATA.startsWith(DIST_CACHE_KEY_GEO)).toBe(true);
  });
});
