"use client";

import { useState, useEffect, useMemo } from "react";
import { EspnAuthRequired } from "@/components/EspnAuthRequired";

interface RosterPlayer {
  name: string;
  pos: string;
  proTeam: string;
  acquisitionType: string;
}

interface EspnTeam {
  id: number;
  name: string;
  roster: RosterPlayer[];
}

const POS_ORDER = ["SP", "RP", "C", "1B", "2B", "3B", "SS", "OF", "DH"];

export default function AcquisitionPatternsPage() {
  const [teams, setTeams] = useState<EspnTeam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/espn/roster")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setTeams(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const positionBreakdown = useMemo(() => {
    if (!teams.length) return [];
    return teams.map((t) => {
      const byPos: Record<string, { drafted: number; added: number; total: number }> = {};
      for (const p of t.roster) {
        const pos = POS_ORDER.includes(p.pos) ? p.pos : "Other";
        if (!byPos[pos]) byPos[pos] = { drafted: 0, added: 0, total: 0 };
        byPos[pos].total++;
        if (p.acquisitionType === "DRAFT") byPos[pos].drafted++;
        else byPos[pos].added++;
      }
      const pitcherAdds = (byPos["SP"]?.added ?? 0) + (byPos["RP"]?.added ?? 0);
      const batterAdds = Object.entries(byPos)
        .filter(([pos]) => pos !== "SP" && pos !== "RP")
        .reduce((sum, [, v]) => sum + v.added, 0);
      return {
        teamName: t.name,
        teamId: t.id,
        byPos,
        pitcherAdds,
        batterAdds,
        spAddPct: (byPos["SP"]?.total ?? 0) > 0
          ? ((byPos["SP"]?.added ?? 0) / (byPos["SP"]?.total ?? 1)) * 100
          : 0,
      };
    }).sort((a, b) => b.pitcherAdds - a.pitcherAdds);
  }, [teams]);

  const leagueAcqSummary = useMemo(() => {
    if (!teams.length) return null;
    let totalAdds = 0, totalDrafted = 0, spAdds = 0, rpAdds = 0, batterAdds = 0;
    for (const t of teams) {
      for (const p of t.roster) {
        if (p.acquisitionType === "DRAFT") totalDrafted++;
        else {
          totalAdds++;
          if (p.pos === "SP") spAdds++;
          else if (p.pos === "RP") rpAdds++;
          else batterAdds++;
        }
      }
    }
    const total = totalAdds + totalDrafted;
    return {
      totalAdds,
      totalDrafted,
      spAdds,
      rpAdds,
      batterAdds,
      addPct: total > 0 ? (totalAdds / total) * 100 : 0,
    };
  }, [teams]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnAuthRequired /></div>;
  }
  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load</div>
        <div className="text-[12px] text-slate-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">Acquisition Patterns</h1>
        <div className="text-[12px] text-slate-500">
          SP vs position player acquisition trends across the league
        </div>
      </div>

      {/* Feature roadmap note */}
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="text-[11px] font-semibold text-blue-700">Current Roster Snapshot</div>
        <div className="text-[11px] text-blue-600 mt-1">
          Full transaction timeline requires ESPN activity API access (not yet available).
          Current view analyzes acquisition type data on current rosters to identify patterns.
        </div>
      </div>

      {/* League summary */}
      {leagueAcqSummary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Total Adds", value: leagueAcqSummary.totalAdds, color: "text-slate-700" },
            { label: "SP Adds", value: leagueAcqSummary.spAdds, color: "text-emerald-600" },
            { label: "RP Adds", value: leagueAcqSummary.rpAdds, color: "text-orange-600" },
            { label: "Batter Adds", value: leagueAcqSummary.batterAdds, color: "text-blue-600" },
            { label: "Add Rate", value: `${leagueAcqSummary.addPct.toFixed(0)}%`, color: "text-slate-700" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-center">
              <div className={`text-[18px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-slate-400 uppercase">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Per-team breakdown */}
      {positionBreakdown.length > 0 && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-surface text-[9px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-1.5 py-2 text-center">SP adds</th>
                <th className="px-1.5 py-2 text-center">RP adds</th>
                <th className="px-1.5 py-2 text-center">Bat adds</th>
                <th className="px-1.5 py-2 text-center">SP add %</th>
                <th className="px-1.5 py-2 text-center">Strategy</th>
              </tr>
            </thead>
            <tbody>
              {positionBreakdown.map((t) => {
                const spAdd = t.byPos["SP"]?.added ?? 0;
                const isStreamer = spAdd >= 3;
                const isHolder = spAdd === 0 && t.batterAdds <= 1;
                return (
                  <tr key={t.teamId} className="border-b border-border/50">
                    <td className="px-3 py-2 text-[11px] font-medium text-slate-700">{t.teamName}</td>
                    <td className={`px-1.5 py-2 text-center font-mono tabular-nums font-bold ${
                      spAdd >= 3 ? "text-emerald-600" : "text-slate-600"
                    }`}>{spAdd}</td>
                    <td className="px-1.5 py-2 text-center font-mono tabular-nums text-slate-600">
                      {t.byPos["RP"]?.added ?? 0}
                    </td>
                    <td className="px-1.5 py-2 text-center font-mono tabular-nums text-slate-600">{t.batterAdds}</td>
                    <td className={`px-1.5 py-2 text-center font-mono tabular-nums ${
                      t.spAddPct >= 50 ? "text-emerald-600 font-bold" : "text-slate-500"
                    }`}>{Number.isFinite(t.spAddPct) ? t.spAddPct.toFixed(0) : 0}%</td>
                    <td className="px-1.5 py-2 text-center">
                      {isStreamer && (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                          Streaming
                        </span>
                      )}
                      {isHolder && (
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-border rounded px-1.5 py-0.5">
                          Holding
                        </span>
                      )}
                      {!isStreamer && !isHolder && (
                        <span className="text-[9px] text-slate-400">Mixed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-700">Insight:</span>{" "}
        Teams with high SP add rates are likely streaming (our strategy). Low SP add rates suggest teams relying on drafted pitchers.
        High batter adds may indicate injury replacements or position player churn.
      </div>
    </div>
  );
}
