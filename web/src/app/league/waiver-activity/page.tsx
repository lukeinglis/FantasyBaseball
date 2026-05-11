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

export default function WaiverActivityPage() {
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

  const teamChurn = useMemo(() => {
    if (!teams.length) return [];
    return teams
      .map((t) => {
        const total = t.roster.length;
        const added = t.roster.filter((p) => p.acquisitionType === "ADD").length;
        const traded = t.roster.filter((p) => p.acquisitionType === "TRADE").length;
        const drafted = t.roster.filter((p) => p.acquisitionType === "DRAFT").length;
        const waiver = t.roster.filter((p) => p.acquisitionType === "CLAIM" || p.acquisitionType === "WAIVER").length;
        const churnPct = total > 0 ? ((total - drafted) / total) * 100 : 0;
        return {
          teamName: t.name,
          teamId: t.id,
          total,
          drafted,
          added,
          traded,
          waiver,
          churnPct: Number.isFinite(churnPct) ? churnPct : 0,
        };
      })
      .sort((a, b) => b.churnPct - a.churnPct);
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
        <h1 className="text-lg font-bold text-gray-900">Waiver Wire Activity</h1>
        <div className="text-[12px] text-slate-500">
          Roster churn and acquisition breakdown by team
        </div>
      </div>

      {/* Feature roadmap note */}
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="text-[11px] font-semibold text-blue-700">Roster Snapshot View</div>
        <div className="text-[11px] text-blue-600 mt-1">
          Full transaction history requires ESPN activity API access (not yet available).
          Current view shows roster churn from acquisition type data on current rosters.
        </div>
      </div>

      {/* Team churn table */}
      {teamChurn.length > 0 && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 text-left">Team</th>
                <th className="px-2 py-2.5 text-center">Roster</th>
                <th className="px-2 py-2.5 text-center">Drafted</th>
                <th className="px-2 py-2.5 text-center">FA Adds</th>
                <th className="px-2 py-2.5 text-center">Trades</th>
                <th className="px-2 py-2.5 text-center">Waivers</th>
                <th className="px-2 py-2.5 text-center">Churn %</th>
              </tr>
            </thead>
            <tbody>
              {teamChurn.map((t) => (
                <tr key={t.teamId} className="border-b border-border/50">
                  <td className="px-3 py-2">
                    <span className="text-[12px] font-medium text-slate-700">{t.teamName}</span>
                  </td>
                  <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-600">{t.total}</td>
                  <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-600">{t.drafted}</td>
                  <td className={`px-2 py-2 text-center font-mono tabular-nums font-bold ${
                    t.added >= 5 ? "text-orange-600" : "text-slate-600"
                  }`}>{t.added}</td>
                  <td className={`px-2 py-2 text-center font-mono tabular-nums ${
                    t.traded > 0 ? "text-violet-600 font-bold" : "text-slate-400"
                  }`}>{t.traded}</td>
                  <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-600">{t.waiver}</td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center gap-1.5 justify-center">
                      <span className={`font-mono tabular-nums font-bold ${
                        t.churnPct >= 40 ? "text-red-600" :
                        t.churnPct >= 20 ? "text-orange-600" : "text-emerald-600"
                      }`}>{t.churnPct.toFixed(0)}%</span>
                      <div className="w-12 h-1.5 rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${
                          t.churnPct >= 40 ? "bg-red-500" :
                          t.churnPct >= 20 ? "bg-orange-500" : "bg-emerald-500"
                        }`} style={{ width: `${Math.min(100, t.churnPct)}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Interpretation */}
      <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-700">Reading the data:</span>{" "}
        High churn teams are actively streaming and adjusting. Low churn teams are holding their draft picks.
        Teams with many FA adds are likely streaming pitchers (the strategy we follow).
      </div>
    </div>
  );
}
