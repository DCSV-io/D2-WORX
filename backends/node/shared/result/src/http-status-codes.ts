/**
 * HTTP status codes used by D2Result.
 * Subset of standard codes relevant to the result pattern.
 */
export const HttpStatusCode = {
  OK: 200,
  Created: 201,
  PartialContent: 206,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  TooManyRequests: 429,
  InternalServerError: 500,
  ServiceUnavailable: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatusCode)[keyof typeof HttpStatusCode];
