import { expect } from 'vitest';
import {
  D2Result,
  type ErrorCode,
  type HttpStatusCode,
  type InputError,
} from '@d2/result';

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

/**
 * Custom Vitest matchers for D2Result assertions.
 * Mirrors FluentAssertions patterns used in .NET tests.
 *
 * Usage:
 *   import '@d2/testing'; // registers matchers
 *   expect(result).toBeSuccess();
 *   expect(result).toBeFailure();
 *   expect(result).toHaveStatusCode(HttpStatusCode.NotFound);
 *   expect(result).toHaveErrorCode(ErrorCodes.NOT_FOUND);
 */

expect.extend({
  toBeSuccess(received: D2Result<unknown>) {
    const pass = received.success === true;
    return {
      pass,
      message: () =>
        pass
          ? `expected result NOT to be success, but it was (status ${received.statusCode})`
          : `expected result to be success, but it failed with status ${received.statusCode}` +
            (received.messages.length > 0
              ? `: ${received.messages.join(', ')}`
              : ''),
    };
  },

  toBeFailure(received: D2Result<unknown>) {
    const pass = received.success === false;
    return {
      pass,
      message: () =>
        pass
          ? `expected result NOT to be a failure, but it was (status ${received.statusCode})`
          : `expected result to be a failure, but it succeeded with status ${received.statusCode}`,
    };
  },

  toHaveStatusCode(received: D2Result<unknown>, expected: HttpStatusCode) {
    const pass = received.statusCode === expected;
    return {
      pass,
      message: () =>
        pass
          ? `expected result NOT to have status code ${expected}`
          : `expected result to have status code ${expected}, but got ${received.statusCode}`,
    };
  },

  toHaveErrorCode(received: D2Result<unknown>, expected: ErrorCode | string) {
    const pass = received.errorCode === expected;
    return {
      pass,
      message: () =>
        pass
          ? `expected result NOT to have error code ${expected}`
          : `expected result to have error code ${expected}, but got ${received.errorCode ?? 'undefined'}`,
    };
  },

  toHaveMessages(received: D2Result<unknown>, expected: string[]) {
    const pass =
      received.messages.length === expected.length &&
      received.messages.every((msg, i) => msg === expected[i]);
    return {
      pass,
      message: () =>
        pass
          ? `expected result NOT to have messages ${JSON.stringify(expected)}`
          : `expected messages ${JSON.stringify(expected)}, but got ${JSON.stringify([...received.messages])}`,
    };
  },

  toHaveData<T>(received: D2Result<T>, expected: T) {
    const pass = JSON.stringify(received.data) === JSON.stringify(expected);
    return {
      pass,
      message: () =>
        pass
          ? `expected result NOT to have data ${JSON.stringify(expected)}`
          : `expected data ${JSON.stringify(expected)}, but got ${JSON.stringify(received.data)}`,
    };
  },

  toHaveInputErrors(
    received: D2Result<unknown>,
    expected: [string, ...string[]][],
  ) {
    const receivedErrors = [...received.inputErrors];
    const pass =
      receivedErrors.length === expected.length &&
      receivedErrors.every(
        (err, i) =>
          err.length === expected[i]!.length &&
          err.every((val, j) => val === expected[i]![j]),
      );
    return {
      pass,
      message: () =>
        pass
          ? `expected result NOT to have input errors ${JSON.stringify(expected)}`
          : `expected input errors ${JSON.stringify(expected)}, but got ${JSON.stringify(receivedErrors)}`,
    };
  },
});
