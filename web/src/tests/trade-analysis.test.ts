import { describe, it, expect } from "vitest";
import {
  safeNum,
  findSurplusCategories,
  computeGapAnalysis,
  findSellHighCandidates,
  findMetricArbitrage,
  type ZScorePlayer,
  type PlayerStats,
} from "@/lib/trade-analysis";

function makePlayer(overrides: Partial<ZScorePlayer> & { name: string }): ZScorePlayer {
  return {
    playerId: 0,
    pos: "OF",
    proTeam: "NYY",
    isPitcher: false,
    onTeamId: 1,
    seasonStats: {},
    zScores: {},
    zTotal: 0,
    far: 0,
    ...overrides,
  };
}

describe("safeNum", () => {
  it("passes through finite numbers", () => {
    expect(safeNum(42)).toBe(42);
    expect(safeNum(-3.5)).toBe(-3.5);
    expect(safeNum(0)).toBe(0);
  });

  it("returns 0 for NaN, Infinity, null, undefined", () => {
    expect(safeNum(NaN)).toBe(0);
    expect(safeNum(Infinity)).toBe(0);
    expect(safeNum(-Infinity)).toBe(0);
    expect(safeNum(null)).toBe(0);
    expect(safeNum(undefined)).toBe(0);
  });

  it("returns 0 for non-number types", () => {
    expect(safeNum("42")).toBe(0);
    expect(safeNum(true)).toBe(0);
  });
});

describe("findSurplusCategories", () => {
  const teamNames = new Map([
    [1, "My Team"],
    [2, "Team B"],
    [3, "Team C"],
    [4, "Team D"],
  ]);

  it("identifies categories where my team ranks top-3", () => {
    const players: ZScorePlayer[] = [
      makePlayer({ name: "P1", onTeamId: 1, zScores: { HR: 2.0, SB: -0.5 }, far: 5 }),
      makePlayer({ name: "P2", onTeamId: 1, zScores: { HR: 1.5, SB: 0.2 }, far: 4 }),
      makePlayer({ name: "P3", onTeamId: 2, zScores: { HR: 0.5, SB: 1.0 }, far: 3 }),
      makePlayer({ name: "P4", onTeamId: 3, zScores: { HR: 0.3, SB: 2.0 }, far: 2 }),
      makePlayer({ name: "P5", onTeamId: 4, zScores: { HR: -0.5, SB: 1.5 }, far: 1 }),
    ];
    const result = findSurplusCategories(players, ["HR", "SB"], 1, teamNames);
    const hrSurplus = result.find((s) => s.cat === "HR");
    expect(hrSurplus).toBeDefined();
    expect(hrSurplus!.rank).toBe(1);
    expect(hrSurplus!.players[0].name).toBe("P1");
    expect(hrSurplus!.players[1].name).toBe("P2");

    const sbSurplus = result.find((s) => s.cat === "SB");
    expect(sbSurplus).toBeUndefined();
  });

  it("returns empty array when no surplus categories exist", () => {
    const players: ZScorePlayer[] = [
      makePlayer({ name: "P1", onTeamId: 1, zScores: { HR: -1.0 }, far: 1 }),
      makePlayer({ name: "P2", onTeamId: 2, zScores: { HR: 2.0 }, far: 5 }),
      makePlayer({ name: "P3", onTeamId: 3, zScores: { HR: 1.5 }, far: 4 }),
      makePlayer({ name: "P4", onTeamId: 4, zScores: { HR: 1.0 }, far: 3 }),
    ];
    const result = findSurplusCategories(players, ["HR"], 1, teamNames);
    expect(result).toHaveLength(0);
  });

  it("returns empty when no players exist", () => {
    expect(findSurplusCategories([], ["HR"], 1, teamNames)).toHaveLength(0);
  });

  it("handles NaN z-scores gracefully", () => {
    const players: ZScorePlayer[] = [
      makePlayer({ name: "P1", onTeamId: 1, zScores: { HR: NaN }, far: 0 }),
      makePlayer({ name: "P2", onTeamId: 2, zScores: { HR: 1.0 }, far: 3 }),
    ];
    const result = findSurplusCategories(players, ["HR"], 1, teamNames);
    expect(result).toHaveLength(0);
  });

  it("only lists players with positive z-scores as trade chips", () => {
    const players: ZScorePlayer[] = [
      makePlayer({ name: "P1", onTeamId: 1, zScores: { HR: 2.0 }, far: 5 }),
      makePlayer({ name: "P2", onTeamId: 1, zScores: { HR: -0.5 }, far: 1 }),
    ];
    const result = findSurplusCategories(players, ["HR"], 1, new Map([[1, "My Team"]]));
    expect(result).toHaveLength(1);
    expect(result[0].players).toHaveLength(1);
    expect(result[0].players[0].name).toBe("P1");
  });
});

describe("findSellHighCandidates", () => {
  it("flags players whose 30-day z-score exceeds season z-score by >0.5", () => {
    const allPlayers: ZScorePlayer[] = [
      makePlayer({
        name: "Hot Hitter",
        onTeamId: 1,
        isPitcher: false,
        seasonStats: { HR: 10, AVG: 0.250 },
        zScores: { HR: 0.0, AVG: 0.0 },
        far: 3,
      }),
      makePlayer({
        name: "Other",
        onTeamId: 2,
        isPitcher: false,
        seasonStats: { HR: 10, AVG: 0.250 },
        zScores: { HR: 0.0, AVG: 0.0 },
        far: 2,
      }),
    ];

    const statsMap = new Map<string, PlayerStats>([
      ["Hot Hitter", {
        name: "Hot Hitter",
        pos: "OF",
        seasonStats: { HR: 10, AVG: 0.250 },
        last30Stats: { HR: 25, AVG: 0.350 },
      }],
    ]);

    const myRoster = [{ name: "Hot Hitter", pos: "OF" }];
    const result = findSellHighCandidates(
      myRoster, allPlayers, statsMap, 1,
      ["HR", "AVG"], [],
    );

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].name).toBe("Hot Hitter");
    expect(result[0].cats.length).toBeGreaterThan(0);
    for (const cat of result[0].cats) {
      expect(cat.diff).toBeGreaterThan(0.5);
    }
  });

  it("does not flag players with similar 30-day and season z-scores", () => {
    const allPlayers: ZScorePlayer[] = [
      makePlayer({
        name: "Steady",
        onTeamId: 1,
        isPitcher: false,
        seasonStats: { HR: 10 },
        zScores: { HR: 0.5 },
        far: 3,
      }),
    ];

    const statsMap = new Map<string, PlayerStats>([
      ["Steady", {
        name: "Steady",
        pos: "1B",
        seasonStats: { HR: 10 },
        last30Stats: { HR: 11 },
      }],
    ]);

    const result = findSellHighCandidates(
      [{ name: "Steady", pos: "1B" }], allPlayers, statsMap, 1,
      ["HR"], [],
    );
    expect(result).toHaveLength(0);
  });

  it("handles missing last30Stats gracefully", () => {
    const allPlayers: ZScorePlayer[] = [
      makePlayer({
        name: "NoRecent",
        onTeamId: 1,
        seasonStats: { HR: 10 },
        zScores: { HR: 0.5 },
      }),
    ];

    const statsMap = new Map<string, PlayerStats>([
      ["NoRecent", {
        name: "NoRecent",
        pos: "OF",
        seasonStats: { HR: 10 },
        last30Stats: {},
      }],
    ]);

    const result = findSellHighCandidates(
      [{ name: "NoRecent", pos: "OF" }], allPlayers, statsMap, 1,
      ["HR"], [],
    );
    expect(result).toHaveLength(0);
  });

  it("handles NaN in last30Stats", () => {
    const allPlayers: ZScorePlayer[] = [
      makePlayer({
        name: "BadData",
        onTeamId: 1,
        seasonStats: { HR: 10 },
        zScores: { HR: 0.5 },
      }),
    ];

    const statsMap = new Map<string, PlayerStats>([
      ["BadData", {
        name: "BadData",
        pos: "OF",
        seasonStats: { HR: 10 },
        last30Stats: { HR: NaN },
      }],
    ]);

    const result = findSellHighCandidates(
      [{ name: "BadData", pos: "OF" }], allPlayers, statsMap, 1,
      ["HR"], [],
    );
    expect(result).toHaveLength(0);
  });
});

describe("computeGapAnalysis", () => {
  const teamNames = new Map([
    [1, "My Team"],
    [2, "Partner"],
  ]);

  it("identifies complementary trade partners", () => {
    const players: ZScorePlayer[] = [
      makePlayer({ name: "P1", onTeamId: 1, zScores: { HR: 3.0, SB: -2.0 } }),
      makePlayer({ name: "P2", onTeamId: 2, zScores: { HR: -2.0, SB: 3.0 } }),
    ];
    const result = computeGapAnalysis(players, ["HR", "SB"], 1, teamNames);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const partner = result.find((p) => p.teamId === 2);
    expect(partner).toBeDefined();
    expect(partner!.theyNeed).toContain("HR");
    expect(partner!.youNeed).toContain("SB");
  });

  it("returns empty when no complementary partners exist", () => {
    const players: ZScorePlayer[] = [
      makePlayer({ name: "P1", onTeamId: 1, zScores: { HR: 1.0 } }),
      makePlayer({ name: "P2", onTeamId: 2, zScores: { HR: 1.0 } }),
    ];
    const result = computeGapAnalysis(players, ["HR"], 1, teamNames);
    expect(result).toHaveLength(0);
  });
});

describe("findMetricArbitrage", () => {
  const teamNames = new Map([
    [1, "My Team"],
    [2, "Other"],
  ]);

  it("flags players with high FAR but low ESPN rank", () => {
    const players: ZScorePlayer[] = [
      makePlayer({ name: "Hidden Gem", playerId: 100, onTeamId: 2, far: 8.0, espnRank: 200 }),
      makePlayer({ name: "Properly Ranked", playerId: 101, onTeamId: 2, far: 5.0, espnRank: 10 }),
    ];
    const result = findMetricArbitrage(players, 1, teamNames);
    const gem = result.find((c) => c.name === "Hidden Gem");
    expect(gem).toBeDefined();
    expect(gem!.rankDiff).toBeGreaterThanOrEqual(20);
  });

  it("excludes my own players", () => {
    const players: ZScorePlayer[] = [
      makePlayer({ name: "My Player", playerId: 100, onTeamId: 1, far: 8.0, espnRank: 200 }),
    ];
    const result = findMetricArbitrage(players, 1, teamNames);
    expect(result).toHaveLength(0);
  });

  it("excludes players without espnRank", () => {
    const players: ZScorePlayer[] = [
      makePlayer({ name: "NoRank", playerId: 100, onTeamId: 2, far: 8.0 }),
    ];
    const result = findMetricArbitrage(players, 1, teamNames);
    expect(result).toHaveLength(0);
  });
});
