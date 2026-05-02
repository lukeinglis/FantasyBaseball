export interface WeakCategory {
  cat: string;
  teamAvgZ: number;
}

export interface RecommendedFA {
  playerId: number;
  name: string;
  pos: string;
  proTeam: string;
  gapScore: number;
  helpsCat: string;
  helpsZ: number;
  far: number;
  zScores: Record<string, number>;
}

export function sanitizeNum(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return v;
}

export function findWeakCategories(
  teamPlayerZScores: { zScores: Record<string, number> }[],
  categories: string[],
  count: number = 3,
): WeakCategory[] {
  if (teamPlayerZScores.length === 0 || categories.length === 0) return [];

  const catAvgs: WeakCategory[] = categories.map((cat) => {
    const vals = teamPlayerZScores
      .map((p) => sanitizeNum(p.zScores[cat]))
      .filter((v) => v !== 0 || teamPlayerZScores.some((p) => p.zScores[cat] !== undefined));
    const sum = vals.reduce((s, v) => s + v, 0);
    const avg = vals.length > 0 ? sum / vals.length : 0;
    return { cat, teamAvgZ: sanitizeNum(avg) };
  });

  catAvgs.sort((a, b) => a.teamAvgZ - b.teamAvgZ);
  return catAvgs.slice(0, Math.min(count, catAvgs.length));
}

export function rankByWeaknessGap(
  freeAgents: {
    playerId: number;
    name: string;
    pos: string;
    proTeam: string;
    zScores: Record<string, number>;
    far: number;
  }[],
  weakCategories: WeakCategory[],
  limit: number = 15,
): RecommendedFA[] {
  if (freeAgents.length === 0 || weakCategories.length === 0) return [];

  const scored: RecommendedFA[] = freeAgents.map((fa) => {
    let gapScore = 0;
    let bestCat = weakCategories[0].cat;
    let bestZ = -Infinity;

    for (const wc of weakCategories) {
      const faZ = sanitizeNum(fa.zScores[wc.cat]);
      const gap = Math.abs(sanitizeNum(wc.teamAvgZ));
      gapScore += faZ * (1 + gap);

      if (faZ > bestZ) {
        bestZ = faZ;
        bestCat = wc.cat;
      }
    }

    return {
      playerId: fa.playerId,
      name: fa.name,
      pos: fa.pos,
      proTeam: fa.proTeam,
      gapScore: sanitizeNum(gapScore),
      helpsCat: bestCat,
      helpsZ: sanitizeNum(bestZ === -Infinity ? 0 : bestZ),
      far: sanitizeNum(fa.far),
      zScores: fa.zScores,
    };
  });

  scored.sort((a, b) => b.gapScore - a.gapScore);
  return scored.slice(0, limit);
}
