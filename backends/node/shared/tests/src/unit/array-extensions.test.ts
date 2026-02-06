import { describe, it, expect } from 'vitest';
import { arrayTruthy, arrayFalsey } from '@d2/utilities';

describe('arrayTruthy', () => {
  it('returns true for array with multiple elements', () => {
    expect(arrayTruthy([1, 2, 3])).toBe(true);
  });

  it('returns true for array with single element', () => {
    expect(arrayTruthy([1])).toBe(true);
  });

  it('returns false for empty array', () => {
    expect(arrayTruthy([])).toBe(false);
  });

  it('returns false for null', () => {
    expect(arrayTruthy(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(arrayTruthy(undefined)).toBe(false);
  });

  it('narrows type when used as type guard', () => {
    const arr: number[] | null = [1, 2];
    if (arrayTruthy(arr)) {
      // TypeScript should know arr is number[] here
      expect(arr.length).toBeGreaterThan(0);
    }
  });
});

describe('arrayFalsey', () => {
  it('returns true for empty array', () => {
    expect(arrayFalsey([])).toBe(true);
  });

  it('returns true for null', () => {
    expect(arrayFalsey(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(arrayFalsey(undefined)).toBe(true);
  });

  it('returns false for array with elements', () => {
    expect(arrayFalsey([1, 2, 3])).toBe(false);
  });

  it('truthy and falsey are always opposites', () => {
    const cases: (number[] | null | undefined)[] = [
      [1, 2, 3],
      [1],
      [],
      null,
      undefined,
    ];

    for (const arr of cases) {
      expect(arrayTruthy(arr)).toBe(!arrayFalsey(arr));
    }
  });
});
