import { ErrorCodes, type ErrorCode } from './error-codes.js';
import { HttpStatusCode } from './http-status-codes.js';

/**
 * Input validation error: [fieldName, ...errorMessages].
 * First element is the field name, remaining elements are error messages.
 */
export type InputError = [field: string, ...errors: string[]];

/**
 * Options for constructing a D2Result.
 */
export interface D2ResultOptions<TData = void> {
  success: boolean;
  data?: TData;
  messages?: string[];
  inputErrors?: InputError[];
  statusCode?: HttpStatusCode;
  errorCode?: ErrorCode | string;
  traceId?: string;
}

/**
 * Standardized result type for operation outcomes.
 * Mirrors D2.Shared.Result.D2Result in .NET.
 *
 * Use static factory methods (ok, fail, notFound, etc.) instead of the constructor.
 */
export class D2Result<TData = void> {
  readonly success: boolean;
  readonly data: TData | undefined;
  readonly messages: readonly string[];
  readonly inputErrors: readonly InputError[];
  readonly statusCode: HttpStatusCode;
  readonly errorCode: ErrorCode | string | undefined;
  readonly traceId: string | undefined;

  constructor(options: D2ResultOptions<TData>) {
    this.success = options.success;
    this.data = options.data;
    this.messages = Object.freeze(options.messages ?? []);
    this.inputErrors = Object.freeze(options.inputErrors ?? []);
    this.statusCode =
      options.statusCode ??
      (options.success ? HttpStatusCode.OK : HttpStatusCode.BadRequest);
    this.errorCode = options.errorCode;
    this.traceId = options.traceId;
  }

  /** True if the result represents a failure. */
  get failed(): boolean {
    return !this.success;
  }

  /**
   * Check if the result is successful and extract the data.
   * Returns the data if successful, undefined otherwise.
   */
  checkSuccess(): TData | undefined {
    return this.success ? this.data : undefined;
  }

  /**
   * Check if the result is a failure and extract partial data (if any).
   * Returns the data if failed (may be partial, e.g. SOME_FOUND), undefined if success.
   */
  checkFailure(): TData | undefined {
    return this.failed ? this.data : undefined;
  }

  // ---------------------------------------------------------------------------
  // Success factories
  // ---------------------------------------------------------------------------

  /** Create a successful result. */
  static ok<T = void>(options?: {
    data?: T;
    messages?: string[];
    traceId?: string;
  }): D2Result<T> {
    return new D2Result<T>({
      success: true,
      data: options?.data,
      messages: options?.messages,
      statusCode: HttpStatusCode.OK,
      traceId: options?.traceId,
    });
  }

  /** Create a successful result with 201 Created status. */
  static created<T = void>(options?: {
    data?: T;
    traceId?: string;
  }): D2Result<T> {
    return new D2Result<T>({
      success: true,
      data: options?.data,
      statusCode: HttpStatusCode.Created,
      traceId: options?.traceId,
    });
  }

  // ---------------------------------------------------------------------------
  // Failure factories
  // ---------------------------------------------------------------------------

  /** Create a general failure result. */
  static fail<T = void>(options?: {
    messages?: string[];
    statusCode?: HttpStatusCode;
    inputErrors?: InputError[];
    errorCode?: ErrorCode | string;
    traceId?: string;
  }): D2Result<T> {
    return new D2Result<T>({
      success: false,
      messages: options?.messages,
      statusCode: options?.statusCode,
      inputErrors: options?.inputErrors,
      errorCode: options?.errorCode,
      traceId: options?.traceId,
    });
  }

  /** Create a 404 Not Found result. */
  static notFound<T = void>(options?: {
    messages?: string[];
    traceId?: string;
  }): D2Result<T> {
    return new D2Result<T>({
      success: false,
      messages: options?.messages ?? ['Resource not found.'],
      statusCode: HttpStatusCode.NotFound,
      errorCode: ErrorCodes.NOT_FOUND,
      traceId: options?.traceId,
    });
  }

  /** Create a 401 Unauthorized result. */
  static unauthorized<T = void>(options?: {
    messages?: string[];
    traceId?: string;
  }): D2Result<T> {
    return new D2Result<T>({
      success: false,
      messages: options?.messages ?? [
        'You must be signed in to perform this action.',
      ],
      statusCode: HttpStatusCode.Unauthorized,
      errorCode: ErrorCodes.UNAUTHORIZED,
      traceId: options?.traceId,
    });
  }

  /** Create a 403 Forbidden result. */
  static forbidden<T = void>(options?: {
    messages?: string[];
    traceId?: string;
  }): D2Result<T> {
    return new D2Result<T>({
      success: false,
      messages: options?.messages ?? ['Insufficient permissions.'],
      statusCode: HttpStatusCode.Forbidden,
      errorCode: ErrorCodes.FORBIDDEN,
      traceId: options?.traceId,
    });
  }

  /** Create a 400 Validation Failed result. */
  static validationFailed<T = void>(options?: {
    messages?: string[];
    inputErrors?: InputError[];
    traceId?: string;
  }): D2Result<T> {
    return new D2Result<T>({
      success: false,
      messages: options?.messages ?? [
        'One or more validation errors occurred.',
      ],
      inputErrors: options?.inputErrors,
      statusCode: HttpStatusCode.BadRequest,
      errorCode: ErrorCodes.VALIDATION_FAILED,
      traceId: options?.traceId,
    });
  }

  /** Create a 409 Conflict result. */
  static conflict<T = void>(options?: {
    messages?: string[];
    traceId?: string;
  }): D2Result<T> {
    return new D2Result<T>({
      success: false,
      messages: options?.messages ?? [
        'Conflict occurred while processing the request.',
      ],
      statusCode: HttpStatusCode.Conflict,
      errorCode: ErrorCodes.CONFLICT,
      traceId: options?.traceId,
    });
  }

  /** Create a 500 Unhandled Exception result. */
  static unhandledException<T = void>(options?: {
    messages?: string[];
    traceId?: string;
  }): D2Result<T> {
    return new D2Result<T>({
      success: false,
      messages: options?.messages ?? [
        'An unhandled exception occurred while processing the request.',
      ],
      statusCode: HttpStatusCode.InternalServerError,
      errorCode: ErrorCodes.UNHANDLED_EXCEPTION,
      traceId: options?.traceId,
    });
  }

  // ---------------------------------------------------------------------------
  // Partial success
  // ---------------------------------------------------------------------------

  /**
   * Create a 206 Partial Content result (some items found, but not all).
   * Marked as failure but includes data.
   */
  static someFound<T = void>(options?: {
    data?: T;
    messages?: string[];
    traceId?: string;
  }): D2Result<T> {
    return new D2Result<T>({
      success: false,
      data: options?.data,
      messages: options?.messages,
      statusCode: HttpStatusCode.PartialContent,
      errorCode: ErrorCodes.SOME_FOUND,
      traceId: options?.traceId,
    });
  }

  // ---------------------------------------------------------------------------
  // Bubbling (propagate errors with type change)
  // ---------------------------------------------------------------------------

  /**
   * Propagate a failure result with a different data type.
   * Preserves all error details, sets data to undefined.
   */
  static bubbleFail<T>(source: D2Result<unknown>): D2Result<T> {
    return new D2Result<T>({
      success: false,
      messages: [...source.messages],
      inputErrors: source.inputErrors.map((ie) => [...ie]),
      statusCode: source.statusCode,
      errorCode: source.errorCode,
      traceId: source.traceId,
    });
  }

  /**
   * Convert a result to a different data type, preserving all details.
   * Optionally provide new data.
   */
  static bubble<T>(
    source: D2Result<unknown>,
    data?: T,
  ): D2Result<T> {
    return new D2Result<T>({
      success: source.success,
      data,
      messages: [...source.messages],
      inputErrors: source.inputErrors.map((ie) => [...ie]),
      statusCode: source.statusCode,
      errorCode: source.errorCode,
      traceId: source.traceId,
    });
  }
}
