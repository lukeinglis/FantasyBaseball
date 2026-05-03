import { describe, it, expect } from "vitest";
import {
  getDoubleStarters,
  rankStreamingTargets,
  type DoubleStarterPitcher,
} from "@/app/gm/bullpen/page";

describe("getDoubleStarters", () => {
  it("returns pitchers with 2+ starts, sorted by ppCount descending", () => {
    const pitchers: DoubleStarterPitcher[] = [
      { name: "Ace", pos: "SP", proTeam: "NYY", onIL: false, ppCount: 3 },
      { name: "Mid", pos: "SP", proTeam: "BOS", onIL: false, ppCount: 2 },
      { name: "Single", pos: "SP", proTeam: "LAD", onIL: false, ppCount: 1 },
    ];
    const result = getDoubleStarters(pitchers);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Ace");
    expect(result[1].name).toBe("Mid");
  });

  it("excludes IL pitchers even with 2+ starts", () => {
    const pitchers: DoubleStarterPitcher[] = [
      { name: "Hurt", pos: "SP", proTeam: "NYY", onIL: true, ppCount: 2 },
      { name: "Healthy", pos: "SP", proTeam: "BOS", onIL: false, ppCount: 2 },
    ];
    const result = getDoubleStarters(pitchers);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Healthy");
  });

  it("excludes RP pitchers", () => {
    const pitchers: DoubleStarterPitcher[] = [
      { name: "Closer", pos: "RP", proTeam: "NYY", onIL: false, ppCount: 3 },
      { name: "Starter", pos: "SP", proTeam: "BOS", onIL: false, ppCount: 2 },
    ];
    const result = getDoubleStarters(pitchers);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Starter");
  });

  it("returns empty array when no pitchers qualify", () => {
    const pitchers: DoubleStarterPitcher[] = [
      { name: "One", pos: "SP", proTeam: "NYY", onIL: false, ppCount: 1 },
      { name: "Zero", pos: "SP", proTeam: "BOS", onIL: false, ppCount: 0 },
    ];
    expect(getDoubleStarters(pitchers)).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(getDoubleStarters([])).toHaveLength(0);
  });

  it("handles NaN/Infinity ppCount values safely", () => {
    const pitchers: DoubleStarterPitcher[] = [
      { name: "NaN", pos: "SP", proTeam: "NYY", onIL: false, ppCount: NaN },
      { name: "Inf", pos: "SP", proTeam: "BOS", onIL: false, ppCount: Infinity },
      { name: "Good", pos: "SP", proTeam: "LAD", onIL: false, ppCount: 2 },
    ];
    const result = getDoubleStarters(pitchers);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Good");
  });
});

describe("rankStreamingTargets", () => {
  it("ranks by opponent batting z-score ascending when provided", () => {
    const targets = [
      { name: "P1", team: "NYY", starts: [{ date: "2026-05-01", opponent: "BOS" }] },
      { name: "P2", team: "LAD", starts: [{ date: "2026-05-01", opponent: "CWS" }] },
      { name: "P3", team: "SF", starts: [{ date: "2026-05-01", opponent: "COL" }] },
    ];
    const zScores: Record<string, number> = {
      BOS: 1.5,
      CWS: -1.2,
      COL: -0.8,
    };
    const result = rankStreamingTargets(targets, zScores);
    expect(result[0].name).toBe("P2");
    expect(result[1].name).toBe("P3");
    expect(result[2].name).toBe("P1");
  });

  it("falls back to starts count when no z-scores provided", () => {
    const targets = [
      { name: "P1", team: "NYY", starts: [{ date: "2026-05-01", opponent: "BOS" }] },
      { name: "P2", team: "LAD", starts: [
        { date: "2026-05-01", opponent: "CWS" },
        { date: "2026-05-03", opponent: "CWS" },
      ]},
    ];
    const result = rankStreamingTargets(targets);
    expect(result[0].name).toBe("P2");
    expect(result[1].name).toBe("P1");
  });

  it("handles missing z-scores for some opponents", () => {
    const targets = [
      { name: "P1", team: "NYY", starts: [{ date: "2026-05-01", opponent: "BOS" }] },
      { name: "P2", team: "LAD", starts: [{ date: "2026-05-01", opponent: "UNKNOWN" }] },
    ];
    const zScores: Record<string, number> = { BOS: 0.5 };
    const result = rankStreamingTargets(targets, zScores);
    expect(result[0].name).toBe("P1");
    expect(result[1].name).toBe("P2");
    expect(result[0].opponentBattingZ).toBe(0.5);
    expect(result[1].opponentBattingZ).toBeNull();
  });

  it("returns empty array for empty input", () => {
    expect(rankStreamingTargets([])).toHaveLength(0);
    expect(rankStreamingTargets([], { BOS: 1.0 })).toHaveLength(0);
  });

  it("averages z-scores across multiple starts with different opponents", () => {
    const targets = [
      {
        name: "P1",
        team: "NYY",
        starts: [
          { date: "2026-05-01", opponent: "CWS" },
          { date: "2026-05-06", opponent: "BOS" },
        ],
      },
    ];
    const zScores: Record<string, number> = { CWS: -2.0, BOS: 2.0 };
    const result = rankStreamingTargets(targets, zScores);
    expect(result[0].opponentBattingZ).toBe(0);
  });

  it("ignores NaN and Infinity in z-score map", () => {
    const targets = [
      { name: "P1", team: "NYY", starts: [{ date: "2026-05-01", opponent: "BOS" }] },
      { name: "P2", team: "LAD", starts: [{ date: "2026-05-01", opponent: "BAD" }] },
    ];
    const zScores: Record<string, number> = { BOS: 0.5, BAD: NaN };
    const result = rankStreamingTargets(targets, zScores);
    expect(result[0].opponentBattingZ).toBe(0.5);
    expect(result[1].opponentBattingZ).toBeNull();
  });

  it("handles z-score map with all Infinity values", () => {
    const targets = [
      { name: "P1", team: "NYY", starts: [{ date: "2026-05-01", opponent: "A" }] },
      { name: "P2", team: "LAD", starts: [{ date: "2026-05-01", opponent: "B" }] },
    ];
    const zScores: Record<string, number> = { A: Infinity, B: -Infinity };
    const result = rankStreamingTargets(targets, zScores);
    expect(result[0].opponentBattingZ).toBeNull();
    expect(result[1].opponentBattingZ).toBeNull();
    expect(result).toHaveLength(2);
  });
});
