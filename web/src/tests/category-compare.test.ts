import { describe, it, expect } from "vitest";
import { compareTeams } from "@/lib/category-compare";

describe("compareTeams", () => {
  it("awards WIN when my value is higher for counting stats", () => {
    const result = compareTeams({ HR: 10 }, { HR: 5 }, ["HR"]);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.catResults[0].result).toBe("WIN");
  });

  it("awards WIN when my value is lower for rate stats (ERA, WHIP, L)", () => {
    const result = compareTeams({ ERA: 2.5 }, { ERA: 4.0 }, ["ERA"]);
    expect(result.wins).toBe(1);
    expect(result.catResults[0].result).toBe("WIN");
  });

  it("handles ties correctly", () => {
    const result = compareTeams({ K: 50 }, { K: 50 }, ["K"]);
    expect(result.ties).toBe(1);
    expect(result.catResults[0].result).toBe("TIE");
  });

  it("handles NaN/Infinity as zero", () => {
    const result = compareTeams({ HR: NaN }, { HR: 5 }, ["HR"]);
    expect(result.losses).toBe(1);
    expect(result.catResults[0].myValue).toBe(0);
  });

  it("compares all 16 categories by default", () => {
    const result = compareTeams({}, {});
    expect(result.catResults.length).toBe(16);
    expect(result.ties).toBe(16);
  });
});
