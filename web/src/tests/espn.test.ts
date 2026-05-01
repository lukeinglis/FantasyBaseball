import { describe, it, expect } from "vitest";
import {
  SLOT_MAP,
  STAT_ID_MAP,
  PRO_TEAM_MAP,
  getProTeam,
  isOnIL,
  dayToDate,
  buildMatchupSchedule,
} from "@/lib/espn";

describe("getProTeam", () => {
  it("returns team abbreviation from proTeamId", () => {
    expect(getProTeam({ proTeamId: 18 })).toBe("NYY");
    expect(getProTeam({ proTeamId: 13 })).toBe("LAD");
  });

  it("returns empty string for unknown proTeamId without fallback", () => {
    expect(getProTeam({ proTeamId: 999 })).toBe("");
  });

  it("falls back to proTeamAbbrev when proTeamId is missing", () => {
    expect(getProTeam({ proTeamAbbrev: "TB" })).toBe("TB");
  });

  it("returns empty string when no team info exists", () => {
    expect(getProTeam({})).toBe("");
  });

  it("returns FA for free agents (proTeamId 0)", () => {
    expect(getProTeam({ proTeamId: 0 })).toBe("FA");
  });
});

describe("isOnIL", () => {
  it("returns true for IL statuses", () => {
    expect(isOnIL("TEN_DAY_DL")).toBe(true);
    expect(isOnIL("SIXTY_DAY_DL")).toBe(true);
    expect(isOnIL("OUT")).toBe(true);
  });

  it("returns false for active players", () => {
    expect(isOnIL("ACTIVE")).toBe(false);
    expect(isOnIL("DAY_TO_DAY")).toBe(false);
  });

  it("returns false for unknown statuses", () => {
    expect(isOnIL("")).toBe(false);
    expect(isOnIL("UNKNOWN")).toBe(false);
  });
});

describe("dayToDate", () => {
  it("converts scoring period 1 to season start date", () => {
    expect(dayToDate(1)).toBe("2026-03-25");
  });

  it("converts day 7 correctly", () => {
    expect(dayToDate(7)).toBe("2026-03-31");
  });
});

describe("buildMatchupSchedule", () => {
  it("returns the correct number of matchup periods", () => {
    const schedule = buildMatchupSchedule(5);
    expect(schedule).toHaveLength(5);
  });

  it("first matchup starts on season start date", () => {
    const schedule = buildMatchupSchedule(3);
    expect(schedule[0].start).toBe("2026-03-25");
  });

  it("subsequent matchups are 7 days each", () => {
    const schedule = buildMatchupSchedule(3);
    const second = schedule[1];
    const start = new Date(second.start);
    const end = new Date(second.end);
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(6);
  });
});

describe("constant maps", () => {
  it("SLOT_MAP covers standard lineup positions", () => {
    expect(SLOT_MAP[0]).toBe("C");
    expect(SLOT_MAP[4]).toBe("SS");
    expect(SLOT_MAP[14]).toBe("SP");
    expect(SLOT_MAP[16]).toBe("BN");
  });

  it("STAT_ID_MAP maps ESPN stat IDs to category names", () => {
    expect(STAT_ID_MAP[5]).toBe("HR");
    expect(STAT_ID_MAP[47]).toBe("ERA");
    expect(STAT_ID_MAP[48]).toBe("K");
  });

  it("PRO_TEAM_MAP covers all 30 MLB teams", () => {
    const teams = Object.values(PRO_TEAM_MAP).filter((t) => t !== "FA");
    expect(teams.length).toBe(30);
  });
});
