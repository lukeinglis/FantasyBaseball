export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { espnFetch, hasEspnCreds, STAT_ID_MAP, POS_MAP, SLOT_MAP, getProTeam } from "@/lib/espn";
import {
  CATEGORY_WEIGHTS,
  LOWER_IS_BETTER,
  ALL_CATS_BY_WEIGHT,
  categoryTier,
  isPunt,
} from "@/lib/category-weights";
import type { EspnLeagueData, EspnRosterEntry, EspnStatBlock, EspnScoreByStat, EspnScheduleRecord } from "@/types/espn";
import logger from "@/lib/logger";
import { safeDivide } from "@/lib/sanitize";

const MY_TEAM_ID = parseInt(process.env.MY_ESPN_TEAM_ID ?? "9");
const CATS_ORDER = ALL_CATS_BY_WEIGHT;
const PIT_CATS = ["K", "QS", "W", "L", "SV", "HD", "ERA", "WHIP"];

const COMPONENT_IDS = { AB: 0, H_BAT: 1, IP: 34, H_PIT: 35, ER: 39, BB_PIT: 38 };

const TARGET_ERA = 3.80;

type Tier = "STRONG" | "MIDDLE" | "WEAK";
type BatterVerdict = "STAR" | "SOLID" | "BELOW_AVG" | "DRAG" | "SMALL_SAMPLE";
type PitcherVerdict = "ACE" | "SOLID" | "BELOW_AVG" | "HURTING";

function clean(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
}


// Build season stats from matchup schedule (proven approach from league-stats)
function buildSeasonStats(
  schedule: EspnScheduleRecord[],
  currentMatchupPeriod: number,
): Record<number, Record<string, number>> {
  const rawById: Record<number, Record<number, number>> = {};
  for (const matchup of schedule) {
    if ((matchup.matchupPeriodId ?? 0) > currentMatchupPeriod) continue;
    for (const side of [matchup.home, matchup.away]) {
      if (!side?.teamId) continue;
      const teamId = side.teamId;
      if (!rawById[teamId]) rawById[teamId] = {};
      const scoreByStat = side.cumulativeScore?.scoreByStat ?? {};
      for (const [statId, statData] of Object.entries(scoreByStat)) {
        const id = parseInt(statId);
        const val = clean((statData as EspnScoreByStat).score);
        rawById[teamId][id] = (rawById[teamId][id] ?? 0) + val;
      }
    }
  }

  const stats: Record<number, Record<string, number>> = {};
  for (const [teamIdStr, raw] of Object.entries(rawById)) {
    const teamId = parseInt(teamIdStr);
    stats[teamId] = {};
    const ipExists = COMPONENT_IDS.IP in raw;
    const abExists = COMPONENT_IDS.AB in raw;
    for (const [statIdStr, cat] of Object.entries(STAT_ID_MAP)) {
      const id = parseInt(statIdStr);
      if (cat === "AVG") {
        if (abExists) {
          const h = raw[COMPONENT_IDS.H_BAT] ?? 0;
          const ab = raw[COMPONENT_IDS.AB];
          stats[teamId][cat] = safeDivide(h, ab);
        } else {
          stats[teamId][cat] = raw[id] ?? 0;
        }
      } else if (cat === "ERA") {
        if (ipExists) {
          const er = raw[COMPONENT_IDS.ER] ?? 0;
          const ip = raw[COMPONENT_IDS.IP];
          stats[teamId][cat] = safeDivide(er * 9, ip);
        } else {
          stats[teamId][cat] = raw[id] ?? 0;
        }
      } else if (cat === "WHIP") {
        if (ipExists) {
          const bb = raw[COMPONENT_IDS.BB_PIT] ?? 0;
          const h = raw[COMPONENT_IDS.H_PIT] ?? 0;
          const ip = raw[COMPONENT_IDS.IP];
          stats[teamId][cat] = safeDivide(bb + h, ip);
        } else {
          stats[teamId][cat] = raw[id] ?? 0;
        }
      } else {
        stats[teamId][cat] = raw[id] ?? 0;
      }
    }
  }
  return stats;
}

// Rank all teams for a given category, return sorted team IDs (best first)
function rankForCategory(
  teamStats: Record<number, Record<string, number>>,
  cat: string,
): { teamId: number; value: number; rank: number }[] {
  const entries = Object.entries(teamStats).map(([tid, cats]) => ({
    teamId: parseInt(tid),
    value: clean(cats[cat]),
  }));

  entries.sort((a, b) =>
    LOWER_IS_BETTER.has(cat) ? a.value - b.value : b.value - a.value
  );

  let rank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].value !== entries[i - 1].value) {
      rank = i + 1;
    }
    (entries[i] as { teamId: number; value: number; rank: number }).rank = rank;
  }
  return entries as { teamId: number; value: number; rank: number }[];
}

function classifyTier(rank: number): Tier {
  if (rank <= 3) return "STRONG";
  if (rank <= 6) return "MIDDLE";
  return "WEAK";
}

function classifyBatter(ops: number): BatterVerdict {
  if (ops > 0.850) return "STAR";
  if (ops > 0.750) return "SOLID";
  if (ops > 0.650) return "BELOW_AVG";
  return "DRAG";
}

function classifyPitcher(era: number): PitcherVerdict {
  if (era <= 3.00) return "ACE";
  if (era <= 3.80) return "SOLID";
  if (era <= 5.00) return "BELOW_AVG";
  return "HURTING";
}

function rankToWinProbability(rank: number, teamCount: number): number {
  if (teamCount <= 1) return 0.5;
  const t = (rank - 1) / (teamCount - 1);
  return Math.max(0.05, Math.min(0.90, 0.90 - t * 0.85));
}

interface CategoryRanking {
  cat: string;
  weight: number;
  rank: number;
  value: number;
  leaderValue: number;
  gap: number;
  tier: Tier;
  tierLabel: string;
  isPunt: boolean;
}

interface BatterAnalysis {
  name: string;
  pos: string;
  slotLabel: string;
  proTeam: string;
  injuryStatus: string;
  ops: number;
  avg: number;
  hr: number;
  rbi: number;
  r: number;
  tb: number;
  sb: number;
  ab: number;
  verdict: BatterVerdict;
}

interface PitcherAnalysis {
  name: string;
  pos: string;
  slotLabel: string;
  proTeam: string;
  injuryStatus: string;
  era: number;
  whip: number;
  k: number;
  w: number;
  qs: number;
  ip: number;
  eraImpact: number;
  verdict: PitcherVerdict;
}

interface MarginToFlip {
  cat: string;
  weight: number;
  currentRank: number;
  targetRank: number;
  myValue: number;
  targetValue: number;
  gap: number;
  direction: "increase" | "decrease";
}

interface ActionItem {
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "DROP" | "IMPROVE" | "TRADE" | "STREAM" | "PUNT";
  message: string;
}

export interface RosterDiagnosisData {
  teamName: string;
  teamId: number;
  record: string;
  categoryRankings: CategoryRanking[];
  batterAnalysis: BatterAnalysis[];
  pitcherAnalysis: PitcherAnalysis[];
  marginToFlip: MarginToFlip[];
  expectedWinsPerWeek: { total: number; byCategory: Record<string, number> };
  actionItems: ActionItem[];
  generatedAt: string;
}

function parsePlayerStats(
  entries: EspnRosterEntry[],
): { batters: BatterAnalysis[]; pitchers: PitcherAnalysis[] } {
  const batters: BatterAnalysis[] = [];
  const pitchers: PitcherAnalysis[] = [];

  const BATTER_SLOTS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 12]);
  const PITCHER_SLOTS = new Set([13, 14, 15]);

  for (const entry of entries) {
    const player = entry.playerPoolEntry?.player;
    if (!player) continue;

    const slotId = entry.lineupSlotId ?? 16;
    if (slotId === 16 || slotId === 17) continue; // skip bench and IL

    const name = player.fullName ?? "Unknown";
    const posId = player.defaultPositionId ?? 0;
    const pos = POS_MAP[posId] ?? "?";
    const slotLabel = SLOT_MAP[slotId] ?? "BN";
    const proTeam = getProTeam(player);
    const injuryStatus = player.injuryStatus ?? "ACTIVE";

    const statBlocks: EspnStatBlock[] = player.stats ?? [];
    const seasonBlock = statBlocks.find((s) => s.id === "002026");
    const raw = seasonBlock?.stats ?? {};

    if (BATTER_SLOTS.has(slotId) && (posId === 2 || posId === 3 || posId === 4 || posId === 5 || posId === 6 || posId === 7 || posId === 8 || posId === 9 || posId === 10)) {
      const ab = clean(raw["0"]);
      const h = clean(raw["1"]);
      const bb = clean(raw["10"]);
      const hr = clean(raw["5"]);
      const tb = clean(raw["8"]);
      const rbi = clean(raw["21"]);
      const r = clean(raw["20"]);
      const sb = clean(raw["23"]);
      const avg = clean(raw["2"]);

      const obp = safeDivide(h + bb, ab + bb);
      const slg = safeDivide(tb, ab);
      const ops = obp + slg;

      batters.push({
        name, pos, slotLabel, proTeam, injuryStatus,
        ops: Number.isFinite(ops) ? ops : 0,
        avg, hr, rbi, r, tb, sb, ab,
        verdict: ab >= 30 ? classifyBatter(ops) : "SMALL_SAMPLE",
      });
    } else if (PITCHER_SLOTS.has(slotId) && (posId === 1 || posId === 11)) {
      const era = clean(raw["47"]);
      const whip = clean(raw["41"]);
      const k = clean(raw["48"]);
      const w = clean(raw["53"]);
      const qs = clean(raw["63"]);
      const ip = clean(raw["34"]);

      const eraImpact = ip > 0 ? era - TARGET_ERA : 0;

      pitchers.push({
        name, pos, slotLabel, proTeam, injuryStatus,
        era, whip, k, w, qs, ip,
        eraImpact: Number.isFinite(eraImpact) ? eraImpact : 0,
        verdict: ip >= 10 ? classifyPitcher(era) : "BELOW_AVG",
      });
    }
  }

  return { batters, pitchers };
}

function generateActionItems(
  categoryRankings: CategoryRanking[],
  batters: BatterAnalysis[],
  pitchers: PitcherAnalysis[],
): ActionItem[] {
  const items: ActionItem[] = [];

  // Flag weak high-impact categories
  for (const cr of categoryRankings) {
    if (cr.isPunt) continue;
    if (cr.tier === "WEAK" && cr.weight >= 0.06) {
      items.push({
        priority: "HIGH",
        type: "IMPROVE",
        message: `${cr.cat} is ranked #${cr.rank} (${cr.tierLabel}). Weight: ${cr.weight.toFixed(3)}. Target FA or trade to improve.`,
      });
    }
  }

  // Flag drag batters
  const drags = batters.filter((b) => b.verdict === "DRAG" && b.ab >= 30);
  for (const d of drags) {
    items.push({
      priority: "HIGH",
      type: "DROP",
      message: `${d.name} (${d.pos}) is a DRAG with .${Math.round(d.ops * 1000)} OPS over ${d.ab} AB. Consider dropping.`,
    });
  }

  // Flag hurting pitchers
  const hurting = pitchers.filter((p) => p.verdict === "HURTING" && p.ip >= 10);
  for (const h of hurting) {
    items.push({
      priority: "HIGH",
      type: "DROP",
      message: `${h.name} has a ${h.era.toFixed(2)} ERA over ${h.ip.toFixed(1)} IP. Actively hurting ratios. Stream replacement.`,
    });
  }

  // Recommend streaming if pitching cats are weak
  const pitCatWeakCount = categoryRankings.filter(
    (cr) => PIT_CATS.includes(cr.cat) && cr.tier === "WEAK" && !cr.isPunt,
  ).length;
  if (pitCatWeakCount >= 2) {
    items.push({
      priority: "MEDIUM",
      type: "STREAM",
      message: `${pitCatWeakCount} pitching categories are WEAK. Prioritize streaming double-start SPs for volume (K, QS, W).`,
    });
  }

  // Note punt categories
  const puntCats = categoryRankings.filter((cr) => cr.isPunt);
  for (const p of puntCats) {
    items.push({
      priority: "LOW",
      type: "PUNT",
      message: `${p.cat} is a punt category (weight ${p.weight.toFixed(3)}). Ranked #${p.rank}. Do not invest resources here.`,
    });
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return items;
}

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  const t0 = Date.now();

  if (!hasEspnCreds()) {
    return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  }
  if (!MY_TEAM_ID) {
    return Response.json({ error: "MY_ESPN_TEAM_ID_MISSING" }, { status: 401 });
  }

  try {
    const data = await espnFetch([
      "mTeam", "mRoster", "mMatchup", "mMatchupScore", "mStatus",
    ]) as EspnLeagueData;

    const currentMatchupPeriod = data.status?.currentMatchupPeriod ?? 1;
    const schedule: EspnScheduleRecord[] = data.schedule ?? [];
    const teamCount = (data.teams ?? []).length;

    // Team name lookup
    const teamMeta: Record<number, { name: string; wins: number; losses: number; ties: number }> = {};
    for (const t of data.teams ?? []) {
      const rec = t.record?.overall ?? {};
      teamMeta[t.id] = {
        name: `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || (t.abbrev ?? ""),
        wins: rec.wins ?? 0,
        losses: rec.losses ?? 0,
        ties: rec.ties ?? 0,
      };
    }

    // Build season stats for all teams
    const teamStats = buildSeasonStats(schedule, currentMatchupPeriod);

    // Rank all teams for each category
    const categoryRankings: CategoryRanking[] = [];
    const marginToFlip: MarginToFlip[] = [];
    const expectedWinsByCategory: Record<string, number> = {};

    for (const cat of CATS_ORDER) {
      const ranked = rankForCategory(teamStats, cat);
      const myEntry = ranked.find((r) => r.teamId === MY_TEAM_ID);
      const leader = ranked[0];
      const myRank = myEntry?.rank ?? teamCount;
      const myValue = myEntry?.value ?? 0;
      const leaderValue = leader?.value ?? 0;

      const lower = LOWER_IS_BETTER.has(cat);
      const gap = lower ? myValue - leaderValue : leaderValue - myValue;

      const weight = CATEGORY_WEIGHTS[cat] ?? 0;
      const tier = classifyTier(myRank);

      categoryRankings.push({
        cat,
        weight,
        rank: myRank,
        value: myValue,
        leaderValue,
        gap: Number.isFinite(gap) ? gap : 0,
        tier,
        tierLabel: `${tier} (${categoryTier(cat)})`,
        isPunt: isPunt(cat),
      });

      // Expected win probability
      expectedWinsByCategory[cat] = rankToWinProbability(myRank, teamCount);

      // Margin to flip: gap between us and team ranked one spot above
      if (myRank > 1) {
        const targetEntry = ranked.find((r) => r.rank === myRank - 1);
        if (targetEntry) {
          const flipGap = lower
            ? myValue - targetEntry.value
            : targetEntry.value - myValue;
          marginToFlip.push({
            cat,
            weight,
            currentRank: myRank,
            targetRank: myRank - 1,
            myValue,
            targetValue: targetEntry.value,
            gap: Number.isFinite(flipGap) ? Math.abs(flipGap) : 0,
            direction: lower ? "decrease" : "increase",
          });
        }
      }
    }

    // Sort margin to flip by weighted efficiency (smallest gap * highest weight = best ROI)
    marginToFlip.sort((a, b) => {
      const aScore = a.gap > 0 ? a.weight / a.gap : 0;
      const bScore = b.gap > 0 ? b.weight / b.gap : 0;
      return bScore - aScore;
    });

    // Expected wins per week
    const totalExpectedWins = Object.values(expectedWinsByCategory).reduce(
      (sum, v) => sum + v, 0,
    );

    // Parse player-level analysis from roster
    const myTeam = (data.teams ?? []).find((t) => t.id === MY_TEAM_ID);
    const rosterEntries = myTeam?.roster?.entries ?? [];
    const { batters, pitchers } = parsePlayerStats(rosterEntries);

    // Generate action items
    const actionItems = generateActionItems(categoryRankings, batters, pitchers);

    const myMeta = teamMeta[MY_TEAM_ID];
    const record = myMeta
      ? `${myMeta.wins}-${myMeta.losses}${myMeta.ties > 0 ? `-${myMeta.ties}` : ""}`
      : "0-0";

    const result: RosterDiagnosisData = {
      teamName: myMeta?.name ?? `Team ${MY_TEAM_ID}`,
      teamId: MY_TEAM_ID,
      record,
      categoryRankings,
      batterAnalysis: batters,
      pitcherAnalysis: pitchers,
      marginToFlip,
      expectedWinsPerWeek: {
        total: Number.isFinite(totalExpectedWins) ? totalExpectedWins : 0,
        byCategory: expectedWinsByCategory,
      },
      actionItems,
      generatedAt: new Date().toISOString(),
    };

    log.info({ op: "roster-diagnosis", durationMs: Date.now() - t0 }, "ok");
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ op: "roster-diagnosis", err: msg }, "failed");
    return Response.json({ error: msg }, { status: 502 });
  }
}
