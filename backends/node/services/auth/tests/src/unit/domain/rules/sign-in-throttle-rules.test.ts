import { describe, it, expect } from "vitest";
import { computeSignInDelay, SIGN_IN_THROTTLE } from "@d2/auth-domain";

describe("computeSignInDelay", () => {
  it("should return 0 for 0 failures", () => {
    expect(computeSignInDelay(0)).toBe(0);
  });

  it("should return 0 for 1 failure", () => {
    expect(computeSignInDelay(1)).toBe(0);
  });

  it("should return 0 for 2 failures", () => {
    expect(computeSignInDelay(2)).toBe(0);
  });

  it("should return 0 for 3 failures (free attempts limit)", () => {
    expect(computeSignInDelay(3)).toBe(0);
  });

  it("should return 5s for 4 failures", () => {
    expect(computeSignInDelay(4)).toBe(5_000);
  });

  it("should return 15s for 5 failures", () => {
    expect(computeSignInDelay(5)).toBe(15_000);
  });

  it("should return 30s for 6 failures", () => {
    expect(computeSignInDelay(6)).toBe(30_000);
  });

  it("should return 1m for 7 failures", () => {
    expect(computeSignInDelay(7)).toBe(60_000);
  });

  it("should return 5m for 8 failures", () => {
    expect(computeSignInDelay(8)).toBe(300_000);
  });

  it("should return 15m (max) for 9 failures", () => {
    expect(computeSignInDelay(9)).toBe(SIGN_IN_THROTTLE.MAX_DELAY_MS);
  });

  it("should cap at 15m for 100 failures", () => {
    expect(computeSignInDelay(100)).toBe(SIGN_IN_THROTTLE.MAX_DELAY_MS);
  });

  it("should return 0 for negative failure count", () => {
    expect(computeSignInDelay(-1)).toBe(0);
  });
});
