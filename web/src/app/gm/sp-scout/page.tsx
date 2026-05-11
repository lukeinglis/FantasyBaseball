"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DataFreshness } from "@/components/DataFreshness";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";
import { sanitizeNum, safeDivide } from "@/lib/sanitize";
import { CATEGORY_WEIGHTS } from "@/lib/category-weights";

interface ZScorePlayer {
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
  espnRank: number;
}

interface ProbableStart {
  date: string;
  pitcherName: string;
  team: string;
  opponent: string;
  gameTime: string;
  isHome: boolean;
}

interface StartsTeam {
  teamId: number;
  teamName: string;
  pitchers: { name: string; pos: string; proTeam: string; onIL: boolean; ppCount: number; ppNextCount: number }[];
}

interface StartsData {
  myTeamId: number;
  currentMatchupPeriod: number;
  currentDates: { start: string; end: string } | null;
  nextDates: { start: string; end: string } | null;
  teams: StartsTeam[];
  rosteredPitchers: string[];
}

interface ProbablePitchersData {
  startDate: string;
  endDate: string;
  byPitcher: Record<string, ProbableStart[]>;
  allStarts: ProbableStart[];
}

interface ZScoresData {
  players: ZScorePlayer[];
  count: number;
  categoryWeights: Record<string, number>;
  batCats: string[];
  pitCats: string[];
}

interface ScoutEntry {
  name: string;
  proTeam: string;
  isRostered: boolean;
  rosterTeamId: number;
  seasonIP: number;
  seasonERA: number;
  seasonWHIP: number;
  seasonK: number;
  seasonW: number;
  seasonQS: number;
  seasonK9: number;
  nextStarts: ProbableStart[];
  startsThisWeek: number;
  startsNextWeek: number;
  streamingScore: number;
  far: number;
  isDoubleStarter: boolean;
}

// Streaming score: volume-weighted. K, QS, W upside vs ERA, WHIP risk.
// Per CLAUDE.md: volume always wins, never sit to protect ratios.
function computeStreamingScore(p: {
  seasonK: number; seasonQS: number; seasonW: number;
  seasonERA: number; seasonWHIP: number; seasonIP: number;
  startsThisWeek: number; far: number;
}): number {
  if (p.seasonIP < 5) return 0;
  const kRate = safeDivide(p.seasonK, p.seasonIP) * 9;
  const qsRate = safeDivide(p.seasonQS, p.seasonIP) * 9;
  const wRate = safeDivide(p.seasonW, p.seasonIP) * 9;

  // Volume upside (K, QS, W contribution weighted by category weights)
  const volumeScore =
    kRate * (CATEGORY_WEIGHTS.K ?? 0.07) +
    qsRate * (CATEGORY_WEIGHTS.QS ?? 0.06) +
    wRate * (CATEGORY_WEIGHTS.W ?? 0.072);

  // Ratio risk (ERA, WHIP: lower is better, so invert)
  const eraRisk = Math.max(0, p.seasonERA - 3.5) * (CATEGORY_WEIGHTS.ERA ?? 0.057);
  const whipRisk = Math.max(0, p.seasonWHIP - 1.15) * (CATEGORY_WEIGHTS.WHIP ?? 0.062);

  // Base score = volume upside minus ratio risk
  let score = volumeScore - (eraRisk + whipRisk) * 0.5;

  // Bonus for more starts this week (volume is king)
  score *= Math.max(1, p.startsThisWeek);

  // Small FAR bonus
  score += p.far * 0.02;

  return score;
}

function fmtVal(cat: string, val: number): string {
  if (!Number.isFinite(val)) return "-";
  if (cat === "ERA" || cat === "WHIP" || cat === "K/9") return val.toFixed(2);
  if (cat === "IP") return val.toFixed(1);
  return String(Math.round(val));
}

function fmtDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function SPScoutPage() {
  const [zScores, setZScores] = useState<ZScoresData | null>(null);
  const [starts, setStarts] = useState<StartsData | null>(null);
  const [probables, setProbables] = useState<ProbablePitchersData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFreeAgentsOnly, setShowFreeAgentsOnly] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/analysis/z-scores").then((r) => r.json()),
      fetch("/api/espn/starts").then((r) => r.json()),
    ])
      .then(([zData, startsData]) => {
        if (zData.error) { setError(zData.error); return; }
        if (startsData.error) { setError(startsData.error); return; }
        setZScores(zData);
        setStarts(startsData);

        const startDate = startsData.currentDates?.start ?? new Date().toISOString().slice(0, 10);
        const endDate = startsData.nextDates?.end ?? (() => {
          const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10);
        })();
        return fetch(`/api/mlb/probable-pitchers?startDate=${startDate}&endDate=${endDate}`)
          .then((r) => r.json())
          .then((pData) => {
            if (!pData.error) setProbables(pData);
          });
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/analysis/z-scores").then((r) => r.json()),
      fetch("/api/espn/starts").then((r) => r.json()),
    ])
      .then(([zData, startsData]) => {
        if (zData.error) { setError(zData.error); return; }
        if (startsData.error) { setError(startsData.error); return; }
        setZScores(zData);
        setStarts(startsData);

        const startDate = startsData.currentDates?.start ?? new Date().toISOString().slice(0, 10);
        const endDate = startsData.nextDates?.end ?? (() => {
          const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10);
        })();
        return fetch(`/api/mlb/probable-pitchers?startDate=${startDate}&endDate=${endDate}`)
          .then((r) => r.json())
          .then((pData) => {
            if (!pData.error) setProbables(pData);
          });
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const scouts = useMemo((): ScoutEntry[] => {
    if (!zScores || !starts) return [];

    const rosteredSet = new Set(starts.rosteredPitchers);

    // Build starts lookup from ESPN data
    const ppLookup: Record<string, { thisWeek: number; nextWeek: number }> = {};
    for (const team of starts.teams) {
      for (const p of team.pitchers) {
        ppLookup[p.name] = { thisWeek: p.ppCount, nextWeek: p.ppNextCount };
      }
    }

    // Filter to SPs only
    const sps = zScores.players.filter((p) => p.isPitcher && p.pos === "SP");

    return sps.map((p): ScoutEntry => {
      const s = p.seasonStats;
      const ip = sanitizeNum(s.IP);
      const k = sanitizeNum(s.K);
      const era = sanitizeNum(s.ERA);
      const whip = sanitizeNum(s.WHIP);
      const w = sanitizeNum(s.W);
      const qs = sanitizeNum(s.QS);
      const k9 = ip > 0 ? (k / ip) * 9 : 0;

      const isRostered = rosteredSet.has(p.name);
      const pp = ppLookup[p.name];
      const startsThisWeek = pp?.thisWeek ?? 0;
      const startsNextWeek = pp?.nextWeek ?? 0;

      const nextStarts = probables?.byPitcher[p.name] ?? [];

      const streamingScore = computeStreamingScore({
        seasonK: k, seasonQS: qs, seasonW: w,
        seasonERA: era, seasonWHIP: whip, seasonIP: ip,
        startsThisWeek, far: p.far,
      });

      return {
        name: p.name,
        proTeam: p.proTeam,
        isRostered,
        rosterTeamId: p.onTeamId,
        seasonIP: ip,
        seasonERA: era,
        seasonWHIP: whip,
        seasonK: k,
        seasonW: w,
        seasonQS: qs,
        seasonK9: k9,
        nextStarts,
        startsThisWeek,
        startsNextWeek,
        streamingScore,
        far: p.far,
        isDoubleStarter: startsThisWeek >= 2,
      };
    }).sort((a, b) => b.streamingScore - a.streamingScore);
  }, [zScores, starts, probables]);

  const filtered = useMemo(() => {
    if (showFreeAgentsOnly) return scouts.filter((s) => !s.isRostered);
    return scouts;
  }, [scouts, showFreeAgentsOnly]);

  const myTeamId = starts?.myTeamId ?? 0;

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading SP scout...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
  }
  if (error || !zScores) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load SP scout</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">SP Streaming Scout</span>
          <DataFreshness onRefresh={fetchData} loading={loading} />
        </div>
        <div className="mt-1 text-[12px] text-slate-500">
          Sorted by streaming score. Volume (K, QS, W) weighted over ratio risk (ERA, WHIP). Double-starters highlighted.
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => setShowFreeAgentsOnly(!showFreeAgentsOnly)}
            className={`rounded border px-3 py-1 text-[11px] font-semibold transition-colors ${
              showFreeAgentsOnly
                ? "border-orange-300 bg-orange-50 text-orange-600"
                : "border-border bg-surface text-slate-500 hover:bg-black/[0.03]"
            }`}
          >
            {showFreeAgentsOnly ? "Free Agents Only" : "All SPs"}
          </button>
          <span className="text-[10px] text-slate-400">
            {filtered.length} pitchers
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-surface overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border bg-black/[0.02]">
              <th className="px-2 py-2 text-left font-semibold text-slate-500 w-4">#</th>
              <th className="px-2 py-2 text-left font-semibold text-slate-500">Player</th>
              <th className="px-2 py-2 text-left font-semibold text-slate-500 w-10">Team</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-500">Score</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-500">Starts</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-500">IP</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-500">ERA</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-500">WHIP</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-500">K</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-500">K/9</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-500">W</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-500">QS</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-500">FAR</th>
              <th className="px-2 py-2 text-left font-semibold text-slate-500">Next Start(s)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 75).map((p, i) => {
              const isMine = p.rosterTeamId === myTeamId;
              return (
                <tr key={p.name} className={`border-b border-border hover:bg-black/[0.02] ${
                  p.isDoubleStarter ? "bg-emerald-50/50" : ""
                } ${isMine ? "border-l-2 border-l-orange-400" : ""}`}>
                  <td className="px-2 py-1.5 text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold ${isMine ? "text-orange-600" : p.isRostered ? "text-slate-700" : "text-emerald-700"}`}>
                        {p.name}
                      </span>
                      {p.isDoubleStarter && (
                        <span className="text-[8px] font-bold bg-emerald-100 text-emerald-700 px-1 rounded">2S</span>
                      )}
                      {!p.isRostered && (
                        <span className="text-[8px] font-bold bg-blue-100 text-blue-700 px-1 rounded">FA</span>
                      )}
                      {isMine && (
                        <span className="text-[8px] font-bold bg-orange-100 text-orange-700 px-1 rounded">MINE</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">{p.proTeam}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums font-bold text-slate-700">
                    {p.streamingScore.toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    <span className={p.startsThisWeek >= 2 ? "text-emerald-600 font-bold" : p.startsThisWeek > 0 ? "text-slate-700" : "text-slate-400"}>
                      {p.startsThisWeek}
                    </span>
                    {p.startsNextWeek > 0 && (
                      <span className="text-slate-400 ml-0.5">/{p.startsNextWeek}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-600">{fmtVal("IP", p.seasonIP)}</td>
                  <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${
                    p.seasonERA <= 3.5 ? "text-emerald-600" : p.seasonERA >= 5 ? "text-red-600" : "text-slate-600"
                  }`}>{fmtVal("ERA", p.seasonERA)}</td>
                  <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${
                    p.seasonWHIP <= 1.15 ? "text-emerald-600" : p.seasonWHIP >= 1.45 ? "text-red-600" : "text-slate-600"
                  }`}>{fmtVal("WHIP", p.seasonWHIP)}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-700 font-semibold">
                    {Math.round(p.seasonK)}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${
                    p.seasonK9 >= 9 ? "text-emerald-600 font-bold" : "text-slate-600"
                  }`}>{fmtVal("K/9", p.seasonK9)}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-600">{Math.round(p.seasonW)}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-600">{Math.round(p.seasonQS)}</td>
                  <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${
                    p.far > 2 ? "text-emerald-600" : p.far < -1 ? "text-red-600" : "text-slate-600"
                  }`}>{p.far.toFixed(1)}</td>
                  <td className="px-2 py-1.5 text-[10px] text-slate-500">
                    {p.nextStarts.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {p.nextStarts.slice(0, 3).map((s, j) => (
                          <span key={j} className="whitespace-nowrap">
                            {fmtDate(s.date)} {s.opponent}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-300">TBD</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-[9px] text-slate-400">
        <span>Score = Volume upside (K/QS/W weighted) minus ratio risk (ERA/WHIP), multiplied by starts this week</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded bg-emerald-100 border border-emerald-300" /> Double-starter
        </span>
        <span>Starts: this week / next week</span>
      </div>
    </div>
  );
}
