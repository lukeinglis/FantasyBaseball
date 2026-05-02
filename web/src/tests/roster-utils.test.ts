import { describe, it, expect } from "vitest";
import { computePercentile, trendDirection, safeNum } from "@/lib/roster-utils";

describe("computePercentile", () => {
  it("returns correct percentile for a value in the middle", () => {
    const allZ = [-2, -1, 0, 1, 2];
    expect(computePercentile(0, allZ)).toBe(40);
    expect(computePercentile(2, allZ)).toBe(80);
    expect(computePercentile(-2, allZ)).toBe(0);
  });

  it("returns 100 when player is above all values", () => {
    expect(computePercentile(5, [1, 2, 3])).toBe(100);
  });

  it("returns 0 for empty array", () => {
    expect(computePercentile(1.5, [])).toBe(0);
  });

  it("handles single element array", () => {
    expect(computePercentile(1, [1])).toBe(0);
    expect(computePercentile(2, [1])).toBe(100);
  });

  it("handles duplicate values", () => {
    const allZ = [1, 1, 1, 2, 3];
    expect(computePercentile(1, allZ)).toBe(0);
    expect(computePercentile(2, allZ)).toBe(60);
  });
});

describe("trendDirection", () => {
  it("detects upward trend", () => {
    expect(trendDirection([1, 3, 5])).toBe("up");
  });

  it("detects downward trend", () => {
    expect(trendDirection([5, 3, 1])).toBe("down");
  });

  it("detects flat trend", () => {
    expect(trendDirection([3, 3, 3])).toBe("flat");
  });

  it("returns nodata for fewer than 2 valid points", () => {
    expect(trendDirection([5])).toBe("nodata");
    expect(trendDirection([])).toBe("nodata");
    expect(trendDirection([undefined, null])).toBe("nodata");
  });

  it("handles null and undefined values in the array", () => {
    expect(trendDirection([null, 1, undefined, 5])).toBe("up");
  });

  it("handles Infinity and NaN gracefully", () => {
    expect(trendDirection([Infinity, 1, 2])).toBe("up");
    expect(trendDirection([NaN, 1, 5])).toBe("up");
    expect(trendDirection([Infinity, NaN])).toBe("nodata");
  });
});

describe("safeNum", () => {
  it("returns 0 for null, undefined, NaN, Infinity", () => {
    expect(safeNum(null)).toBe(0);
    expect(safeNum(undefined)).toBe(0);
    expect(safeNum(NaN)).toBe(0);
    expect(safeNum(Infinity)).toBe(0);
    expect(safeNum(-Infinity)).toBe(0);
  });

  it("returns the value for valid numbers", () => {
    expect(safeNum(42)).toBe(42);
    expect(safeNum(-3.14)).toBe(-3.14);
    expect(safeNum(0)).toBe(0);
  });
});
