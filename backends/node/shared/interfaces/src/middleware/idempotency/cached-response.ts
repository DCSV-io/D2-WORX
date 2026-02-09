/** Cached HTTP response for idempotent request replay. */
export interface CachedResponse {
  statusCode: number;
  body: string | undefined;
  contentType: string | undefined;
}
