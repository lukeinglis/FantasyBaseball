import { describe, it, expect } from "vitest";
import {
  sanitizeCatVal,
  buildTeamCatValues,
  rankByCategory,
  type TeamCatValues,
} from "@/app/league/scoreboard/page";

describe("sanitizeCatVal", () => {
  it("passes through finite numbers", () => {
    expect(sanitizeCatVal(42)).toBe(42);
    expect(sanitizeCatVal(0)).toBe(0);
    expect(sanitizeCatVal(-5)).toBe(-5);
  });

  it("returns 0 for NaN", () => {
    expect(sanitizeCatVal(NaN)).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(sanitizeCatVal(Infinity)).toBe(0);
    expect(sanitizeCatVal(-Infinity)).toBe(0);
  });

  it("returns 0 for null", () => {
    expect(sanitizeCatVal(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(sanitizeCatVal(undefined)).toBe(0);
  });

  it("returns 0 for non-number types", () => {
    expect(sanitizeCatVal("50")).toBe(0);
  });
});

describe("rankByCategory — basic sort", () => {
  const teams: TeamCatValues[] = [
    { teamId: 1, teamName: "A", values: { HR: 30 } },
    { teamId: 2, teamName: "B", values: { HR: 50 } },
    { teamId: 3, teamName: "C", values: { HR: 40 } },
  ];

  it("assigns rank 1 to the team with the highest value for higher-is-better cats", () => {
    const ranks = rankByCategory(teams, "HR");
    expect(ranks[2]).toBe(1);
    expect(ranks[3]).toBe(2);
    expect(ranks[1]).toBe(3);
  });

  it("assigns rank 1 to the team with the lowest ERA (lower-is-better)", () => {
    const eraTeams: TeamCatValues[] = [
      { teamId: 1, teamName: "A", values: { ERA: 4.5 } },
      { teamId: 2, teamName: "B", values: { ERA: 2.1 } },
      { teamId: 3, teamName: "C", values: { ERA: 3.3 } },
    ];
    const ranks = rankByCategory(eraTeams, "ERA");
    expect(ranks[2]).toBe(1);
    expect(ranks[3]).toBe(2);
    expect(ranks[1]).toBe(3);
  });
});

describe("rankByCategory — tie handling", () => {
  it("assigns the same rank to tied teams", () => {
    const teams: TeamCatValues[] = [
      { teamId: 1, teamName: "A", values: { HR: 40 } },
      { teamId: 2, teamName: "B", values: { HR: 40 } },
      { teamId: 3, teamName: "C", values: { HR: 30 } },
    ];
    const ranks = rankByCategory(teams, "HR");
    expect(ranks[1]).toBe(1);
    expect(ranks[2]).toBe(1);
    expect(ranks[3]).toBe(3);
  });

  it("skips the rank after a tie (standard ranking, not dense)", () => {
    const teams: TeamCatValues[] = [
      { teamId: 1, teamName: "A", values: { HR: 50 } },
      { teamId: 2, teamName: "B", values: { HR: 50 } },
      { teamId: 3, teamName: "C", values: { HR: 50 } },
      { teamId: 4, teamName: "D", values: { HR: 20 } },
    ];
    const ranks = rankByCategory(teams, "HR");
    expect(ranks[1]).toBe(1);
    expect(ranks[2]).toBe(1);
    expect(ranks[3]).toBe(1);
    expect(ranks[4]).toBe(4);
  });

  it("handles all teams tied", () => {
    const teams: TeamCatValues[] = [
      { teamId: 1, teamName: "A", values: { SB: 10 } },
      { teamId: 2, teamName: "B", values: { SB: 10 } },
    ];
    const ranks = rankByCategory(teams, "SB");
    expect(ranks[1]).toBe(1);
    expect(ranks[2]).toBe(1);
  });
});

describe("buildTeamCatValues", () => {
  it("extracts home and away team values from matchups", () => {
    const matchups = [
      {
        homeTeamId: 1,
        homeTeamName: "Home",
        homeWins: 5,
        homeLosses: 3,
        homeTies: 0,
        awayTeamId: 2,
        awayTeamName: "Away",
        awayWins: 3,
        awayLosses: 5,
        awayTies: 0,
        categories: [
          { cat: "HR", homeValue: 10, awayValue: 7, result: "HOME" as const },
        ],
      },
    ];
    const teams = buildTeamCatValues(matchups);
    expect(teams).toHaveLength(2);
    const home = teams.find((t) => t.teamId === 1);
    const away = teams.find((t) => t.teamId === 2);
    expect(home?.values.HR).toBe(10);
    expect(away?.values.HR).toBe(7);
  });

  it("sanitizes NaN and Infinity in category values", () => {
    const matchups = [
      {
        homeTeamId: 1,
        homeTeamName: "Home",
        homeWins: 0,
        homeLosses: 0,
        homeTies: 0,
        awayTeamId: 2,
        awayTeamName: "Away",
        awayWins: 0,
        awayLosses: 0,
        awayTies: 0,
        categories: [
          { cat: "ERA", homeValue: NaN, awayValue: Infinity, result: "TIE" as const },
        ],
      },
    ];
    const teams = buildTeamCatValues(matchups);
    const home = teams.find((t) => t.teamId === 1);
    const away = teams.find((t) => t.teamId === 2);
    expect(home?.values.ERA).toBe(0);
    expect(away?.values.ERA).toBe(0);
  });

  it("returns empty array for no matchups", () => {
    expect(buildTeamCatValues([])).toHaveLength(0);
  });
});
