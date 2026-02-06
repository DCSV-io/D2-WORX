import type { ErrorCode, HttpStatusCode, InputError } from '@d2/result';

/**
 * Augments Vitest's Assertion interface with custom D2Result matchers.
 */
declare module 'vitest' {
  interface Assertion<T> {
    /** Assert that the result is a success (success === true). */
    toBeSuccess(): void;
    /** Assert that the result is a failure (success === false). */
    toBeFailure(): void;
    /** Assert that the result has the expected HTTP status code. */
    toHaveStatusCode(expected: HttpStatusCode): void;
    /** Assert that the result has the expected error code. */
    toHaveErrorCode(expected: ErrorCode | string): void;
    /** Assert that the result has exactly the expected messages. */
    toHaveMessages(expected: string[]): void;
    /** Assert that the result data deep-equals the expected value. */
    toHaveData<T>(expected: T): void;
    /** Assert that the result has exactly the expected input errors. */
    toHaveInputErrors(expected: InputError[]): void;
  }
}
