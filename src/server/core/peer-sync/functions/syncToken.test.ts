import { describe, expect, it } from "vitest";
import {
  generateSyncToken,
  isStrongSyncToken,
  MIN_SYNC_TOKEN_LENGTH,
  safeTokenEqual,
} from "./syncToken.ts";

describe("isStrongSyncToken", () => {
  it("rejects undefined", () => {
    expect(isStrongSyncToken(undefined)).toBe(false);
  });

  it("rejects short tokens", () => {
    expect(isStrongSyncToken("a".repeat(MIN_SYNC_TOKEN_LENGTH - 1))).toBe(false);
  });

  it("accepts tokens at the threshold", () => {
    expect(isStrongSyncToken("a".repeat(MIN_SYNC_TOKEN_LENGTH))).toBe(true);
  });

  it("accepts tokens above the threshold", () => {
    expect(isStrongSyncToken("a".repeat(64))).toBe(true);
  });
});

describe("generateSyncToken", () => {
  it("returns a base64url string of sufficient strength", () => {
    const token = generateSyncToken();
    expect(isStrongSyncToken(token)).toBe(true);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns distinct tokens across calls", () => {
    expect(generateSyncToken()).not.toEqual(generateSyncToken());
  });
});

describe("safeTokenEqual", () => {
  it("matches identical tokens", () => {
    expect(safeTokenEqual("abc123", "abc123")).toBe(true);
  });

  it("rejects different-length tokens", () => {
    expect(safeTokenEqual("abc123", "abc1234")).toBe(false);
  });

  it("rejects different tokens of equal length", () => {
    expect(safeTokenEqual("abc123", "xyz123")).toBe(false);
  });
});
