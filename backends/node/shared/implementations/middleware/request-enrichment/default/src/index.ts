import type { RequestEnrichment } from "@d2/interfaces";

/** @deprecated Import from @d2/interfaces instead: `import type { RequestEnrichment } from "@d2/interfaces"` */
export type IRequestInfo = RequestEnrichment.IRequestInfo;

export { RequestInfo } from "./request-info.js";
export { resolveIp, isLocalhost } from "./ip-resolver.js";
export { buildServerFingerprint } from "./fingerprint-builder.js";
export {
  type RequestEnrichmentOptions,
  DEFAULT_REQUEST_ENRICHMENT_OPTIONS,
} from "./request-enrichment-options.js";
export { enrichRequest } from "./enrich-request.js";
