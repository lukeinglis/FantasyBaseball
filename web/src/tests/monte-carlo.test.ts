import { describe, it, expect } from "vitest";
import { simulateCategoryWinProb } from "@/lib/monte-carlo";

describe("simulateCategoryWinProb", () => {
  it("returns 100 when leading with 0 days remaining", () => {
    expect(simulateCategoryWinProb(10, 5, 1, 0, false)).toBe(100);
  });

  it("returns 0 when trailing with 0 days remaining", () => {
    expect(simulateCategoryWinProb(5, 10, 1, 0, false)).toBe(0);
  });

  it("returns 50 when tied with 0 days remaining", () => {
    expect(simulateCategoryWinProb(5, 5, 1, 0, false)).toBe(50);
  });

  it("returns 50 for NaN inputs (coin flip guard)", () => {
    expect(simulateCategoryWinProb(NaN, 5, 1, 3, false)).toBe(50);
    expect(simulateCategoryWinProb(5, NaN, 1, 3, false)).toBe(50);
    expect(simulateCategoryWinProb(5, 5, NaN, 3, false)).toBe(50);
  });

  it("returns 50 for Infinity inputs", () => {
    expect(simulateCategoryWinProb(Infinity, 5, 1, 3, false)).toBe(50);
    expect(simulateCategoryWinProb(5, Infinity, 1, 3, false)).toBe(50);
  });

  it("returns near 100 for a large lead with minimal remaining variance", () => {
    const prob = simulateCategoryWinProb(100, 0, 0.1, 1, false);
    expect(prob).toBeGreaterThan(95);
  });

  it("returns near 0 for a large deficit with minimal remaining variance", () => {
    const prob = simulateCategoryWinProb(0, 100, 0.1, 1, false);
    expect(prob).toBeLessThan(5);
  });

  it("handles lowerIsBetter correctly: lower ERA wins", () => {
    // ERA=2 vs ERA=4 with 0 days left: lower is better, I win
    expect(simulateCategoryWinProb(2, 4, 0.1, 0, true)).toBe(100);
    expect(simulateCategoryWinProb(4, 2, 0.1, 0, true)).toBe(0);
  });

  it("returns near 50 for equal projections with variance remaining", () => {
    const prob = simulateCategoryWinProb(10, 10, 2, 5, false);
    expect(prob).toBeGreaterThan(35);
    expect(prob).toBeLessThan(65);
  });
});
