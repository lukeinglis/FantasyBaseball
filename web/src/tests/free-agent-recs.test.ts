import { describe, it, expect } from "vitest";
import {
  sanitizeNum,
  findWeakCategories,
  rankByWeaknessGap,
} from "@/lib/free-agent-recs";

describe("sanitizeNum", () => {
  it("passes through finite numbers", () => {
    expect(sanitizeNum(42)).toBe(42);
    expect(sanitizeNum(0)).toBe(0);
    expect(sanitizeNum(-3.5)).toBe(-3.5);
  });

  it("returns 0 for NaN", () => {
    expect(sanitizeNum(NaN)).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(sanitizeNum(Infinity)).toBe(0);
    expect(sanitizeNum(-Infinity)).toBe(0);
  });

  it("returns 0 for null and undefined", () => {
    expect(sanitizeNum(null)).toBe(0);
    expect(sanitizeNum(undefined)).toBe(0);
  });

  it("returns 0 for non-number types", () => {
    expect(sanitizeNum("10")).toBe(0);
    expect(sanitizeNum({})).toBe(0);
  });
});

describe("findWeakCategories", () => {
  it("returns the N categories with lowest average z-scores", () => {
    const players = [
      { zScores: { HR: 1.5, AVG: -0.8, RBI: 0.2, SB: -1.5 } },
      { zScores: { HR: 0.5, AVG: -0.4, RBI: 0.4, SB: -1.1 } },
    ];
    const result = findWeakCategories(players, ["HR", "AVG", "RBI", "SB"], 2);
    expect(result).toHaveLength(2);
    expect(result[0].cat).toBe("SB");
    expect(result[1].cat).toBe("AVG");
  });

  it("returns empty for empty player list", () => {
    expect(findWeakCategories([], ["HR", "AVG"], 3)).toEqual([]);
  });

  it("returns empty for empty categories", () => {
    const players = [{ zScores: { HR: 1.0 } }];
    expect(findWeakCategories(players, [], 3)).toEqual([]);
  });

  it("handles all-positive z-scores by returning the least positive", () => {
    const players = [
      { zScores: { HR: 2.0, AVG: 0.5, RBI: 1.0 } },
    ];
    const result = findWeakCategories(players, ["HR", "AVG", "RBI"], 2);
    expect(result[0].cat).toBe("AVG");
    expect(result[0].teamAvgZ).toBeCloseTo(0.5);
  });

  it("limits count to available categories", () => {
    const players = [{ zScores: { HR: 1.0, AVG: -0.5 } }];
    const result = findWeakCategories(players, ["HR", "AVG"], 5);
    expect(result).toHaveLength(2);
  });
});

describe("rankByWeaknessGap", () => {
  const weakCats = [
    { cat: "SB", teamAvgZ: -1.5 },
    { cat: "AVG", teamAvgZ: -0.8 },
  ];

  it("ranks FAs by weighted gap contribution to weak categories", () => {
    const fas = [
      { playerId: 1, name: "Player A", pos: "OF", proTeam: "NYY", zScores: { SB: 2.0, AVG: 0.5 }, far: 3.0 },
      { playerId: 2, name: "Player B", pos: "SS", proTeam: "BOS", zScores: { SB: 0.3, AVG: 1.5 }, far: 2.0 },
      { playerId: 3, name: "Player C", pos: "1B", proTeam: "LAD", zScores: { SB: 1.5, AVG: 1.0 }, far: 4.0 },
    ];

    const result = rankByWeaknessGap(fas, weakCats, 15);
    expect(result).toHaveLength(3);
    // Player A has strong SB z-score (2.0) in the weakest category (gap 1.5)
    // Player C also strong but A's SB advantage is larger
    expect(result[0].name).toBe("Player A");
    expect(result[0].helpsCat).toBe("SB");
  });

  it("identifies the correct helpsCat for each FA", () => {
    const fas = [
      { playerId: 1, name: "Speed Guy", pos: "OF", proTeam: "NYY", zScores: { SB: 2.5, AVG: 0.1 }, far: 1.0 },
      { playerId: 2, name: "Contact Guy", pos: "2B", proTeam: "BOS", zScores: { SB: 0.1, AVG: 2.5 }, far: 1.0 },
    ];

    const result = rankByWeaknessGap(fas, weakCats, 15);
    const speedGuy = result.find((r) => r.name === "Speed Guy")!;
    const contactGuy = result.find((r) => r.name === "Contact Guy")!;
    expect(speedGuy.helpsCat).toBe("SB");
    expect(contactGuy.helpsCat).toBe("AVG");
  });

  it("returns empty for empty FA list", () => {
    expect(rankByWeaknessGap([], weakCats, 15)).toEqual([]);
  });

  it("returns empty for empty weak categories", () => {
    const fas = [
      { playerId: 1, name: "A", pos: "OF", proTeam: "NYY", zScores: { SB: 1.0 }, far: 1.0 },
    ];
    expect(rankByWeaknessGap(fas, [], 15)).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const fas = Array.from({ length: 20 }, (_, i) => ({
      playerId: i,
      name: `P${i}`,
      pos: "OF",
      proTeam: "NYY",
      zScores: { SB: i * 0.1, AVG: 0 },
      far: 1.0,
    }));
    const result = rankByWeaknessGap(fas, weakCats, 5);
    expect(result).toHaveLength(5);
  });

  it("sanitizes NaN/Infinity z-scores to 0", () => {
    const fas = [
      { playerId: 1, name: "Bad Data", pos: "OF", proTeam: "NYY", zScores: { SB: NaN, AVG: Infinity }, far: NaN },
    ];
    const result = rankByWeaknessGap(fas, weakCats, 15);
    expect(result).toHaveLength(1);
    expect(Number.isFinite(result[0].gapScore)).toBe(true);
    expect(Number.isFinite(result[0].far)).toBe(true);
    expect(result[0].gapScore).toBe(0);
  });

  it("handles missing z-score categories gracefully", () => {
    const fas = [
      { playerId: 1, name: "Pitcher", pos: "SP", proTeam: "NYY", zScores: { K: 2.0, ERA: -0.5 }, far: 3.0 },
    ];
    const result = rankByWeaknessGap(fas, weakCats, 15);
    expect(result).toHaveLength(1);
    expect(Number.isFinite(result[0].gapScore)).toBe(true);
  });
});
