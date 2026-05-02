import { describe, it, expect } from "vitest";
import {
  CATEGORY_WEIGHTS, HIGH_IMPACT_CATS, MEDIUM_IMPACT_CATS, LOW_IMPACT_CATS, PUNT_CATS,
  BAT_CATS_BY_WEIGHT, PIT_CATS_BY_WEIGHT, ALL_CATS_BY_WEIGHT, LOWER_IS_BETTER,
  categoryTier, categoryWeight, isHighImpact, isPunt,
  categoryTierClass, categoryTierHeaderClass, weightedCategorySort,
} from "@/lib/category-weights";

describe("CATEGORY_WEIGHTS", () => {
  it("contains all 16 categories", () => {
    expect(Object.keys(CATEGORY_WEIGHTS)).toHaveLength(16);
  });

  it("has TB as highest weight and SV as lowest", () => {
    const sorted = Object.entries(CATEGORY_WEIGHTS).sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe("TB");
    expect(sorted[sorted.length - 1][0]).toBe("SV");
  });

  it("all weights sum to approximately 1.0", () => {
    const sum = Object.values(CATEGORY_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });
});

describe("tier sets", () => {
  it("are mutually exclusive", () => {
    for (const cat of HIGH_IMPACT_CATS) {
      expect(MEDIUM_IMPACT_CATS.has(cat)).toBe(false);
      expect(LOW_IMPACT_CATS.has(cat)).toBe(false);
      expect(PUNT_CATS.has(cat)).toBe(false);
    }
  });

  it("collectively cover all 16 categories", () => {
    const all = new Set([...HIGH_IMPACT_CATS, ...MEDIUM_IMPACT_CATS, ...LOW_IMPACT_CATS, ...PUNT_CATS]);
    expect(all.size).toBe(16);
  });
});

describe("weight-ordered arrays", () => {
  it("BAT_CATS_BY_WEIGHT starts with TB and ends with AVG", () => {
    expect(BAT_CATS_BY_WEIGHT[0]).toBe("TB");
    expect(BAT_CATS_BY_WEIGHT[BAT_CATS_BY_WEIGHT.length - 1]).toBe("AVG");
  });

  it("PIT_CATS_BY_WEIGHT starts with W and ends with SV", () => {
    expect(PIT_CATS_BY_WEIGHT[0]).toBe("W");
    expect(PIT_CATS_BY_WEIGHT[PIT_CATS_BY_WEIGHT.length - 1]).toBe("SV");
  });

  it("ALL_CATS_BY_WEIGHT has 16 entries", () => {
    expect(ALL_CATS_BY_WEIGHT).toHaveLength(16);
  });
});

describe("LOWER_IS_BETTER", () => {
  it("contains exactly ERA, WHIP, L", () => {
    expect(LOWER_IS_BETTER).toEqual(new Set(["ERA", "WHIP", "L"]));
  });
});

describe("categoryTier", () => {
  it("returns correct tiers", () => {
    expect(categoryTier("TB")).toBe("high");
    expect(categoryTier("K")).toBe("medium");
    expect(categoryTier("SB")).toBe("low");
    expect(categoryTier("SV")).toBe("punt");
  });

  it("returns punt for unknown categories", () => {
    expect(categoryTier("UNKNOWN")).toBe("punt");
  });
});

describe("categoryWeight", () => {
  it("returns correct weight for known categories", () => {
    expect(categoryWeight("TB")).toBe(0.1137);
    expect(categoryWeight("SV")).toBe(0.0018);
  });

  it("returns 0 for unknown categories", () => {
    expect(categoryWeight("FAKE")).toBe(0);
  });
});

describe("isHighImpact / isPunt", () => {
  it("identifies high impact correctly", () => {
    expect(isHighImpact("TB")).toBe(true);
    expect(isHighImpact("HR")).toBe(true);
    expect(isHighImpact("K")).toBe(false);
    expect(isHighImpact("SV")).toBe(false);
  });

  it("identifies punt correctly", () => {
    expect(isPunt("SV")).toBe(true);
    expect(isPunt("HD")).toBe(true);
    expect(isPunt("K")).toBe(false);
    expect(isPunt("TB")).toBe(false);
  });
});

describe("categoryTierClass / categoryTierHeaderClass", () => {
  it("returns non-empty strings for all tiers", () => {
    expect(categoryTierClass("TB").length).toBeGreaterThan(0);
    expect(categoryTierClass("K").length).toBeGreaterThan(0);
    expect(categoryTierClass("SB").length).toBeGreaterThan(0);
    expect(categoryTierClass("SV").length).toBeGreaterThan(0);
    expect(categoryTierHeaderClass("TB").length).toBeGreaterThan(0);
    expect(categoryTierHeaderClass("SV").length).toBeGreaterThan(0);
  });
});

describe("weightedCategorySort", () => {
  it("sorts categories by weight descending", () => {
    const sorted = weightedCategorySort(["SV", "TB", "K", "HR"]);
    expect(sorted).toEqual(["TB", "HR", "K", "SV"]);
  });
});
