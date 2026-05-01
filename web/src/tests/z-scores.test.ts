import { describe, it, expect } from "vitest";
import { mean, stddev } from "@/lib/z-scores";

describe("mean", () => {
  it("computes the average of a list", () => {
    expect(mean([2, 4, 6])).toBe(4);
  });

  it("returns 0 for an empty array", () => {
    expect(mean([])).toBe(0);
  });

  it("handles a single element", () => {
    expect(mean([5])).toBe(5);
  });

  it("handles negative values", () => {
    expect(mean([-2, 0, 2])).toBe(0);
  });

  it("handles large values without overflow", () => {
    expect(mean([1e15, 1e15])).toBe(1e15);
  });
});

describe("stddev", () => {
  it("computes standard deviation correctly", () => {
    const vals = [2, 4, 4, 4, 5, 5, 7, 9];
    const mu = mean(vals);
    const sd = stddev(vals, mu);
    expect(sd).toBeCloseTo(2, 0);
  });

  it("returns 1 for a single element (prevents division by zero)", () => {
    expect(stddev([5], 5)).toBe(1);
  });

  it("returns 1 for an empty array", () => {
    expect(stddev([], 0)).toBe(1);
  });

  it("returns 1 when all values are identical (zero variance fallback)", () => {
    expect(stddev([3, 3, 3, 3], 3)).toBe(1);
  });

  it("handles two identical elements", () => {
    expect(stddev([7, 7], 7)).toBe(1);
  });

  it("z-score division is safe with stddev fallback", () => {
    const vals = [10, 10, 10];
    const mu = mean(vals);
    const sd = stddev(vals, mu);
    const z = (10 - mu) / sd;
    expect(Number.isFinite(z)).toBe(true);
    expect(z).toBe(0);
  });
});
