import { RateLimit } from "@d2/interfaces";

export { Check } from "./handlers/check.js";
export { RATELIMIT_CACHE_KEYS } from "./cache-keys.js";

/** @deprecated Import from @d2/interfaces instead: `import { RateLimit } from "@d2/interfaces"` */
export type CheckInput = RateLimit.CheckInput;
/** @deprecated Import from @d2/interfaces instead: `import { RateLimit } from "@d2/interfaces"` */
export type CheckOutput = RateLimit.CheckOutput;
/** @deprecated Import from @d2/interfaces instead: `import { RateLimit } from "@d2/interfaces"` */
export const RateLimitDimension = RateLimit.RateLimitDimension;
/** @deprecated Import from @d2/interfaces instead: `import { RateLimit } from "@d2/interfaces"` */
export type RateLimitDimension = RateLimit.RateLimitDimension;

export { type RateLimitOptions, DEFAULT_RATE_LIMIT_OPTIONS } from "./rate-limit-options.js";
