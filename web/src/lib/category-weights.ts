export const CATEGORY_WEIGHTS: Record<string, number> = {
  TB: 0.1137, HR: 0.1079, R: 0.0997, RBI: 0.0988,
  H: 0.0832, W: 0.0723, K: 0.0703, WHIP: 0.0623,
  QS: 0.0602, ERA: 0.0571, SB: 0.0462, BB: 0.0345,
  AVG: 0.0340, L: 0.0326, HD: 0.0254, SV: 0.0018,
};

export const HIGH_IMPACT_CATS = new Set(["TB", "HR", "R", "RBI"]);
export const MEDIUM_IMPACT_CATS = new Set(["H", "W", "K", "WHIP", "QS", "ERA"]);
export const LOW_IMPACT_CATS = new Set(["SB", "BB", "AVG", "L"]);
export const PUNT_CATS = new Set(["HD", "SV"]);

export const BAT_CATS_BY_WEIGHT = ["TB", "HR", "R", "RBI", "H", "SB", "BB", "AVG"];
export const PIT_CATS_BY_WEIGHT = ["W", "K", "WHIP", "QS", "ERA", "L", "HD", "SV"];
export const ALL_CATS_BY_WEIGHT = [...BAT_CATS_BY_WEIGHT, ...PIT_CATS_BY_WEIGHT];

export const LOWER_IS_BETTER = new Set(["ERA", "WHIP", "L"]);

export type CategoryTier = "high" | "medium" | "low" | "punt";

export function categoryTier(cat: string): CategoryTier {
  if (HIGH_IMPACT_CATS.has(cat)) return "high";
  if (MEDIUM_IMPACT_CATS.has(cat)) return "medium";
  if (LOW_IMPACT_CATS.has(cat)) return "low";
  return "punt";
}

export function categoryWeight(cat: string): number {
  return CATEGORY_WEIGHTS[cat] ?? 0;
}

export function isHighImpact(cat: string): boolean {
  return HIGH_IMPACT_CATS.has(cat);
}

export function isPunt(cat: string): boolean {
  return PUNT_CATS.has(cat);
}

export function categoryTierClass(cat: string): string {
  const tier = categoryTier(cat);
  if (tier === "high") return "font-bold text-slate-900";
  if (tier === "medium") return "font-medium text-slate-700";
  if (tier === "low") return "text-slate-500";
  return "text-slate-400 opacity-60";
}

export function categoryTierHeaderClass(cat: string): string {
  const tier = categoryTier(cat);
  if (tier === "high") return "font-bold";
  if (tier === "medium") return "font-medium";
  if (tier === "low") return "text-slate-500";
  return "text-slate-400 opacity-60";
}

export function weightedCategorySort(cats: string[]): string[] {
  return [...cats].sort((a, b) => (CATEGORY_WEIGHTS[b] ?? 0) - (CATEGORY_WEIGHTS[a] ?? 0));
}

export const STRATEGY_CONTEXT = `=== LEAGUE STRATEGY CONTEXT ===
Category weights (Spearman correlation to winning):
  High impact (>0.09): TB (0.114), HR (0.108), R (0.100), RBI (0.099)
  Medium impact (0.05-0.09): H (0.083), W (0.072), K (0.070), WHIP (0.062), QS (0.060), ERA (0.057)
  Low impact (0.03-0.05): SB (0.046), BB (0.035), AVG (0.034), L (0.033)
  Punt (<0.03): HD (0.025), SV (0.002)

Strategy rules:
- SV is weight 0.002. Do NOT recommend closers, saves-focused pickups, or any move that prioritizes saves.
- Stream SPs aggressively. More starts = more K, QS, W. Never recommend sitting a pitcher to protect ratios.
- Double-start SPs are the highest priority streaming targets.
- Always use all weekly moves (adds/drops). Unused moves are wasted.
- Minimal bench bats. Bench hitters do not score. Roster spots go to streaming pitchers.
- Surplus in punt categories (SV, HD) has near-zero trade value. Surplus in power cats (TB, HR, R, RBI) is real capital.
- When evaluating pickups, weight contribution to high-impact categories above FAR alone.`;
