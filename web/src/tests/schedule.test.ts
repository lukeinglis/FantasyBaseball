import { describe, it, expect } from "vitest";
import { computeMatchupStrength, buildZScoreMap } from "@/app/league/schedule/page";

const ALL_CATS = ["H", "R", "HR", "TB", "RBI", "BB", "SB", "AVG", "K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];

function zeroZ(): Record<string, number> {
  return Object.fromEntries(ALL_CATS.map((c) => [c, 0]));
}

describe("computeMatchupStrength", () => {
  it("returns score near 0 when both teams have identical z-scores", () => {
    const z = zeroZ();
    const result = computeMatchupStrength(z, z);
    expect(result.score).toBe(0);
  });

  it("returns negative score (favorable) when I am stronger in all categories", () => {
    const myZ = Object.fromEntries(ALL_CATS.map((c) => [c, 1.0]));
    const oppZ = zeroZ();
    const result = computeMatchupStrength(myZ, oppZ);
    expect(result.score).toBeLessThan(-0.3);
  });

  it("returns positive score (tough) when opponent is stronger in all categories", () => {
    const myZ = zeroZ();
    const oppZ = Object.fromEntries(ALL_CATS.map((c) => [c, 1.0]));
    const result = computeMatchupStrength(myZ, oppZ);
    expect(result.score).toBeGreaterThan(0.3);
  });

  it("returns exactly 2 top categories", () => {
    const myZ = zeroZ();
    const oppZ = Object.fromEntries(ALL_CATS.map((c, i) => [c, i * 0.1]));
    const result = computeMatchupStrength(myZ, oppZ);
    expect(result.topCategories).toHaveLength(2);
  });

  it("treats missing z-scores as 0", () => {
    const myZ: Record<string, number> = {};
    const oppZ: Record<string, number> = {};
    const result = computeMatchupStrength(myZ, oppZ);
    expect(result.score).toBe(0);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("mixed-category fixture: computes score correctly", () => {
    // Opponent is better in half, I am better in half.
    // With weighted scoring the result is not zero because even/odd indexed
    // categories carry different total weight.
    const myZ: Record<string, number> = {};
    const oppZ: Record<string, number> = {};
    for (let i = 0; i < ALL_CATS.length; i++) {
      const cat = ALL_CATS[i];
      myZ[cat] = i % 2 === 0 ? 1.0 : -1.0;
      oppZ[cat] = i % 2 === 0 ? -1.0 : 1.0;
    }
    const result = computeMatchupStrength(myZ, oppZ);
    // Weighted mean with CATEGORY_WEIGHTS yields ~-0.15 (favorable)
    expect(result.score).toBeCloseTo(-0.1504, 3);
  });

  it("top categories are the ones with the largest absolute differential", () => {
    const myZ = zeroZ();
    const oppZ = { ...zeroZ(), ERA: 3.0, HR: 2.5, WHIP: 0.1 };
    const result = computeMatchupStrength(myZ, oppZ);
    expect(result.topCategories).toContain("ERA");
    expect(result.topCategories).toContain("HR");
  });
});

describe("buildZScoreMap", () => {
  it("assigns z-score 0 to a team exactly at the mean", () => {
    const teams = [
      { teamId: 1, categories: { HR: 10 } },
      { teamId: 2, categories: { HR: 20 } },
      { teamId: 3, categories: { HR: 30 } },
    ];
    const averages = { HR: 20 };
    const zMap = buildZScoreMap(teams, averages);
    expect(zMap[2]["HR"]).toBeCloseTo(0, 5);
  });

  it("assigns positive z-score to team above mean on higher-is-better stat", () => {
    const teams = [
      { teamId: 1, categories: { HR: 10 } },
      { teamId: 2, categories: { HR: 30 } },
    ];
    const averages = { HR: 20 };
    const zMap = buildZScoreMap(teams, averages);
    expect(zMap[2]["HR"]).toBeGreaterThan(0);
    expect(zMap[1]["HR"]).toBeLessThan(0);
  });

  it("flips sign for lower-is-better stats (ERA): lower ERA = positive z-score", () => {
    const teams = [
      { teamId: 1, categories: { ERA: 2.0 } },
      { teamId: 2, categories: { ERA: 5.0 } },
    ];
    const averages = { ERA: 3.5 };
    const zMap = buildZScoreMap(teams, averages);
    // team 1 has lower ERA = better, so positive z
    expect(zMap[1]["ERA"]).toBeGreaterThan(0);
    expect(zMap[2]["ERA"]).toBeLessThan(0);
  });

  it("treats missing category values as 0", () => {
    const teams = [
      { teamId: 1, categories: {} as Record<string, number> },
      { teamId: 2, categories: { HR: 10 } as Record<string, number> },
    ];
    const averages = { HR: 5 };
    const zMap = buildZScoreMap(teams, averages);
    expect(Number.isFinite(zMap[1]["HR"])).toBe(true);
  });

  it("handles all teams with identical values (zero variance)", () => {
    const teams = [
      { teamId: 1, categories: { HR: 10 } },
      { teamId: 2, categories: { HR: 10 } },
    ];
    const averages = { HR: 10 };
    const zMap = buildZScoreMap(teams, averages);
    expect(Number.isFinite(zMap[1]["HR"])).toBe(true);
    expect(Number.isFinite(zMap[2]["HR"])).toBe(true);
  });
});
