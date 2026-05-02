import { mean, stddev } from "@/lib/z-scores";

export interface ZScorePlayer {
  name: string;
  playerId: number;
  pos: string;
  proTeam: string;
  isPitcher: boolean;
  onTeamId: number;
  seasonStats: Record<string, number>;
  zScores: Record<string, number>;
  zTotal: number;
  far: number;
  espnRank?: number;
}

export interface PlayerStats {
  name: string;
  pos: string;
  seasonStats: Record<string, number>;
  last30Stats: Record<string, number>;
}

export interface TeamCatStrength {
  teamId: number;
  teamName: string;
  catZTotals: Record<string, number>;
}

export interface SurplusCategory {
  cat: string;
  rank: number;
  teamTotal: number;
  players: { name: string; pos: string; zScore: number }[];
}

export interface GapPartner {
  teamId: number;
  teamName: string;
  theyNeed: string[];
  youNeed: string[];
  complementScore: number;
}

export interface SellHighCandidate {
  name: string;
  pos: string;
  cats: { cat: string; seasonZ: number; last30Z: number; diff: number }[];
  avgDiff: number;
}

export interface ArbitrageCandidate {
  name: string;
  pos: string;
  proTeam: string;
  teamName: string;
  far: number;
  farRank: number;
  espnRank: number;
  rankDiff: number;
}

const INVERT_CATS = new Set(["ERA", "WHIP", "L"]);

export function safeNum(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return v;
}

export function computeTeamCatStrengths(
  players: ZScorePlayer[],
  cats: string[],
  teamNames: Map<number, string>,
): TeamCatStrength[] {
  const byTeam = new Map<number, ZScorePlayer[]>();
  for (const p of players) {
    if (p.onTeamId === 0) continue;
    const list = byTeam.get(p.onTeamId) ?? [];
    list.push(p);
    byTeam.set(p.onTeamId, list);
  }

  const strengths: TeamCatStrength[] = [];
  for (const [teamId, roster] of byTeam) {
    const catZTotals: Record<string, number> = {};
    for (const cat of cats) {
      const total = roster.reduce((sum, p) => sum + safeNum(p.zScores[cat]), 0);
      catZTotals[cat] = safeNum(total);
    }
    strengths.push({
      teamId,
      teamName: teamNames.get(teamId) ?? `Team ${teamId}`,
      catZTotals,
    });
  }
  return strengths;
}

export function rankTeamsByCategory(
  strengths: TeamCatStrength[],
  cat: string,
): Record<number, number> {
  const sorted = [...strengths]
    .map((t) => ({ teamId: t.teamId, val: safeNum(t.catZTotals[cat]) }))
    .sort((a, b) => b.val - a.val);

  const result: Record<number, number> = {};
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].val !== sorted[i - 1].val) {
      rank = i + 1;
    }
    result[sorted[i].teamId] = rank;
  }
  return result;
}

export function findSurplusCategories(
  players: ZScorePlayer[],
  cats: string[],
  myTeamId: number,
  teamNames: Map<number, string>,
): SurplusCategory[] {
  const strengths = computeTeamCatStrengths(players, cats, teamNames);
  if (strengths.length === 0) return [];

  const surpluses: SurplusCategory[] = [];
  for (const cat of cats) {
    const ranks = rankTeamsByCategory(strengths, cat);
    const myRank = ranks[myTeamId];
    if (myRank === undefined || myRank > 3) continue;

    const myStrength = strengths.find((s) => s.teamId === myTeamId);
    const myPlayers = players
      .filter((p) => p.onTeamId === myTeamId && safeNum(p.zScores[cat]) > 0)
      .sort((a, b) => safeNum(b.zScores[cat]) - safeNum(a.zScores[cat]))
      .slice(0, 5)
      .map((p) => ({ name: p.name, pos: p.pos, zScore: safeNum(p.zScores[cat]) }));

    if (myPlayers.length > 0) {
      surpluses.push({
        cat,
        rank: myRank,
        teamTotal: safeNum(myStrength?.catZTotals[cat]),
        players: myPlayers,
      });
    }
  }

  return surpluses.sort((a, b) => a.rank - b.rank);
}

export function computeGapAnalysis(
  players: ZScorePlayer[],
  cats: string[],
  myTeamId: number,
  teamNames: Map<number, string>,
): GapPartner[] {
  const strengths = computeTeamCatStrengths(players, cats, teamNames);
  const myStrength = strengths.find((s) => s.teamId === myTeamId);
  if (!myStrength) return [];

  const partners: GapPartner[] = [];
  for (const opp of strengths) {
    if (opp.teamId === myTeamId) continue;

    const theyNeed: string[] = [];
    const youNeed: string[] = [];
    let complementScore = 0;

    for (const cat of cats) {
      const myVal = safeNum(myStrength.catZTotals[cat]);
      const oppVal = safeNum(opp.catZTotals[cat]);
      const diff = oppVal - myVal;
      const threshold = 2.0;

      if (diff > threshold) {
        youNeed.push(cat);
      } else if (diff < -threshold) {
        theyNeed.push(cat);
      }

      if ((diff > threshold && myVal < 0) || (diff < -threshold && oppVal < 0)) {
        complementScore += Math.abs(diff);
      }
    }

    if (theyNeed.length > 0 && youNeed.length > 0) {
      partners.push({
        teamId: opp.teamId,
        teamName: opp.teamName,
        theyNeed,
        youNeed,
        complementScore: safeNum(complementScore),
      });
    }
  }

  return partners.sort((a, b) => b.complementScore - a.complementScore);
}

export function findSellHighCandidates(
  myRoster: { name: string; pos: string }[],
  allPlayers: ZScorePlayer[],
  playerStatsMap: Map<string, PlayerStats>,
  myTeamId: number,
  batCats: string[],
  pitCats: string[],
): SellHighCandidate[] {
  const batters = allPlayers.filter((p) => !p.isPitcher);
  const pitchers = allPlayers.filter((p) => p.isPitcher);

  const batDistributions: Record<string, { mu: number; sd: number }> = {};
  for (const cat of batCats) {
    const vals = batters
      .map((p) => p.seasonStats[cat])
      .filter((v) => v !== undefined && v !== null && Number.isFinite(v)) as number[];
    if (vals.length === 0) {
      batDistributions[cat] = { mu: 0, sd: 1 };
    } else {
      const mu = mean(vals);
      batDistributions[cat] = { mu, sd: stddev(vals, mu) };
    }
  }

  const pitDistributions: Record<string, { mu: number; sd: number }> = {};
  for (const cat of pitCats) {
    const vals = pitchers
      .map((p) => p.seasonStats[cat])
      .filter((v) => v !== undefined && v !== null && Number.isFinite(v)) as number[];
    if (vals.length === 0) {
      pitDistributions[cat] = { mu: 0, sd: 1 };
    } else {
      const mu = mean(vals);
      pitDistributions[cat] = { mu, sd: stddev(vals, mu) };
    }
  }

  const candidates: SellHighCandidate[] = [];

  for (const rosterPlayer of myRoster) {
    const zp = allPlayers.find(
      (p) => p.name === rosterPlayer.name && p.onTeamId === myTeamId,
    );
    const ps = playerStatsMap.get(rosterPlayer.name);
    if (!zp || !ps) continue;

    const isPitcher = zp.isPitcher;
    const cats = isPitcher ? pitCats : batCats;
    const distributions = isPitcher ? pitDistributions : batDistributions;

    const elevatedCats: SellHighCandidate["cats"] = [];

    for (const cat of cats) {
      const seasonZ = safeNum(zp.zScores[cat]);
      const last30Val = ps.last30Stats[cat];
      if (last30Val === undefined || last30Val === null || !Number.isFinite(last30Val)) continue;

      const dist = distributions[cat];
      if (!dist || dist.sd === 0) continue;

      let last30Z = (last30Val - dist.mu) / dist.sd;
      if (INVERT_CATS.has(cat)) last30Z = -last30Z;
      last30Z = safeNum(last30Z);

      const diff = last30Z - seasonZ;
      if (diff > 0.5) {
        elevatedCats.push({ cat, seasonZ, last30Z, diff: safeNum(diff) });
      }
    }

    if (elevatedCats.length > 0) {
      const avgDiff = safeNum(
        elevatedCats.reduce((s, c) => s + c.diff, 0) / elevatedCats.length,
      );
      candidates.push({
        name: rosterPlayer.name,
        pos: rosterPlayer.pos,
        cats: elevatedCats.sort((a, b) => b.diff - a.diff),
        avgDiff,
      });
    }
  }

  return candidates.sort((a, b) => b.avgDiff - a.avgDiff);
}

export function findMetricArbitrage(
  players: ZScorePlayer[],
  myTeamId: number,
  teamNames: Map<number, string>,
): ArbitrageCandidate[] {
  const rostered = players.filter((p) => p.onTeamId > 0 && p.onTeamId !== myTeamId);
  const sortedByFar = [...rostered].sort((a, b) => b.far - a.far);

  const farRankMap = new Map<number, number>();
  let rank = 1;
  for (let i = 0; i < sortedByFar.length; i++) {
    if (i > 0 && sortedByFar[i].far !== sortedByFar[i - 1].far) {
      rank = i + 1;
    }
    farRankMap.set(sortedByFar[i].playerId, rank);
  }

  const candidates: ArbitrageCandidate[] = [];
  for (const p of rostered) {
    const espnRank = p.espnRank;
    if (espnRank === undefined || espnRank === null) continue;

    const farRank = farRankMap.get(p.playerId);
    if (farRank === undefined) continue;

    const rankDiff = espnRank - farRank;
    if (rankDiff >= 20 && p.far > 0) {
      candidates.push({
        name: p.name,
        pos: p.pos,
        proTeam: p.proTeam,
        teamName: teamNames.get(p.onTeamId) ?? `Team ${p.onTeamId}`,
        far: safeNum(p.far),
        farRank,
        espnRank,
        rankDiff,
      });
    }
  }

  return candidates.sort((a, b) => b.rankDiff - a.rankDiff).slice(0, 10);
}
