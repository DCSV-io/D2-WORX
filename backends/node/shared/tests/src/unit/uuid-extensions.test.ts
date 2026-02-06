import { describe, it, expect } from 'vitest';
import { uuidTruthy, uuidFalsey, EMPTY_UUID } from '@d2/utilities';

describe('EMPTY_UUID', () => {
  it('equals the all-zeros UUID string', () => {
    expect(EMPTY_UUID).toBe('00000000-0000-0000-0000-000000000000');
  });
});

describe('uuidTruthy', () => {
  it('returns true for a valid UUID', () => {
    expect(uuidTruthy('12345678-1234-1234-1234-123456789012')).toBe(true);
  });

  it('returns true for a crypto.randomUUID() value', () => {
    expect(uuidTruthy(crypto.randomUUID())).toBe(true);
  });

  it('returns false for null', () => {
    expect(uuidTruthy(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(uuidTruthy(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(uuidTruthy('')).toBe(false);
  });

  it('returns false for the all-zeros UUID', () => {
    expect(uuidTruthy(EMPTY_UUID)).toBe(false);
  });

  it('returns false for EMPTY_UUID constant', () => {
    expect(uuidTruthy('00000000-0000-0000-0000-000000000000')).toBe(false);
  });
});

describe('uuidFalsey', () => {
  it('returns true for null', () => {
    expect(uuidFalsey(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(uuidFalsey(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(uuidFalsey('')).toBe(true);
  });

  it('returns true for the all-zeros UUID', () => {
    expect(uuidFalsey(EMPTY_UUID)).toBe(true);
  });

  it('returns false for a valid UUID', () => {
    expect(uuidFalsey('12345678-1234-1234-1234-123456789012')).toBe(false);
  });

  it('truthy and falsey are always opposites', () => {
    const cases: (string | null | undefined)[] = [
      crypto.randomUUID(),
      '12345678-1234-1234-1234-123456789012',
      EMPTY_UUID,
      '',
      null,
      undefined,
    ];

    for (const uuid of cases) {
      expect(uuidTruthy(uuid)).toBe(!uuidFalsey(uuid));
    }
  });
});
