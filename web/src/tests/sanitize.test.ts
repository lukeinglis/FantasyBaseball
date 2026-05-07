import { describe, it, expect } from "vitest";
import { sanitizeNum, formatStat, safeDivide } from "@/lib/sanitize";

describe("sanitizeNum", () => {
  it("returns valid numbers unchanged", () => {
    expect(sanitizeNum(42)).toBe(42);
    expect(sanitizeNum(0)).toBe(0);
    expect(sanitizeNum(-3.5)).toBe(-3.5);
  });

  it("returns fallback for NaN, Infinity", () => {
    expect(sanitizeNum(NaN)).toBe(0);
    expect(sanitizeNum(Infinity)).toBe(0);
    expect(sanitizeNum(-Infinity)).toBe(0);
  });

  it("returns fallback for non-numbers", () => {
    expect(sanitizeNum(null)).toBe(0);
    expect(sanitizeNum(undefined)).toBe(0);
    expect(sanitizeNum("42")).toBe(0);
    expect(sanitizeNum({})).toBe(0);
  });

  it("supports custom fallback", () => {
    expect(sanitizeNum(NaN, -1)).toBe(-1);
    expect(sanitizeNum(null, 99)).toBe(99);
  });
});

describe("formatStat", () => {
  it("formats valid numbers", () => {
    expect(formatStat(3.14159, 2)).toBe("3.14");
    expect(formatStat(42, 0)).toBe("42");
  });

  it("returns dash for invalid values", () => {
    expect(formatStat(NaN)).toBe("-");
    expect(formatStat(Infinity)).toBe("-");
    expect(formatStat(null)).toBe("-");
    expect(formatStat(undefined)).toBe("-");
    expect(formatStat("42")).toBe("-");
  });

  it("defaults to 1 decimal", () => {
    expect(formatStat(3.14159)).toBe("3.1");
  });
});

describe("safeDivide", () => {
  it("divides normally", () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(1, 3)).toBeCloseTo(0.333, 2);
  });

  it("returns fallback for division by zero", () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 0, -1)).toBe(-1);
  });

  it("returns fallback for non-finite inputs", () => {
    expect(safeDivide(Infinity, 2)).toBe(0);
    expect(safeDivide(10, NaN)).toBe(0);
    expect(safeDivide(NaN, NaN)).toBe(0);
  });
});
