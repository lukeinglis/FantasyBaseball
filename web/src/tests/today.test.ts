import { describe, it, expect } from "vitest";
import { scoreActionItem, sanitizeNum } from "@/app/gm/today/page";

describe("sanitizeNum", () => {
  it("passes through finite numbers", () => {
    expect(sanitizeNum(42)).toBe(42);
    expect(sanitizeNum(0)).toBe(0);
    expect(sanitizeNum(-5)).toBe(-5);
  });

  it("returns 0 for NaN", () => {
    expect(sanitizeNum(NaN)).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(sanitizeNum(Infinity)).toBe(0);
    expect(sanitizeNum(-Infinity)).toBe(0);
  });

  it("returns 0 for null", () => {
    expect(sanitizeNum(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(sanitizeNum(undefined)).toBe(0);
  });

  it("returns 0 for non-number types", () => {
    expect(sanitizeNum("30")).toBe(0);
  });
});

describe("scoreActionItem", () => {
  it("sums stats for at-risk higher-is-better categories", () => {
    const stats = { HR: 30, RBI: 100, SB: 20 };
    expect(scoreActionItem(stats, ["HR", "RBI"])).toBe(130);
  });

  it("ranks player A higher than B when A has more HR", () => {
    const statsA = { HR: 30 };
    const statsB = { HR: 20 };
    const scoreA = scoreActionItem(statsA, ["HR"]);
    const scoreB = scoreActionItem(statsB, ["HR"]);
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  it("inverts lower-is-better cats: lower ERA gives higher score", () => {
    const statsA = { ERA: 2.5 };
    const statsB = { ERA: 4.5 };
    const scoreA = scoreActionItem(statsA, ["ERA"]);
    const scoreB = scoreActionItem(statsB, ["ERA"]);
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  it("handles mixed higher-is-better and lower-is-better cats", () => {
    const stats = { HR: 30, ERA: 3.0 };
    const score = scoreActionItem(stats, ["HR", "ERA"]);
    expect(score).toBe(30 - 3.0);
  });

  it("returns 0 for empty at-risk categories", () => {
    expect(scoreActionItem({ HR: 30 }, [])).toBe(0);
  });

  it("returns 0 for missing stat keys", () => {
    expect(scoreActionItem({}, ["HR", "RBI"])).toBe(0);
  });

  it("sanitizes NaN in stats to 0", () => {
    expect(scoreActionItem({ HR: NaN }, ["HR"])).toBe(0);
  });

  it("sanitizes Infinity in stats to 0", () => {
    expect(scoreActionItem({ HR: Infinity }, ["HR"])).toBe(0);
    expect(scoreActionItem({ ERA: -Infinity }, ["ERA"])).toBe(0);
  });

  it("sorts three players correctly by HR contribution", () => {
    const players = [
      { name: "A", stats: { HR: 20 } },
      { name: "B", stats: { HR: 40 } },
      { name: "C", stats: { HR: 10 } },
    ];
    const scored = players
      .map(p => ({ ...p, score: scoreActionItem(p.stats, ["HR"]) }))
      .sort((a, b) => b.score - a.score);
    expect(scored[0].name).toBe("B");
    expect(scored[1].name).toBe("A");
    expect(scored[2].name).toBe("C");
  });

  it("accepts a custom lowerIsBetter set", () => {
    const custom = new Set(["CUSTOM"]);
    const stats = { CUSTOM: 5 };
    // With custom lower-is-better, higher value = lower score
    expect(scoreActionItem(stats, ["CUSTOM"], custom)).toBe(-5);
  });
});
