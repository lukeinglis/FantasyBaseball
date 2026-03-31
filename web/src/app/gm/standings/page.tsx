"use client";

import { useState, useEffect, useMemo } from "react";

interface StandingsTeam {
  teamId: number;
  teamName: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  gamesBack: number;
  streak: string;
  rank: number;
  playoffSeed: number;
}

interface StandingsData {
  currentMatchupPeriod: number;
  totalMatchupPeriods: number;
  myTeamId: number;
  teams: StandingsTeam[];
}

function EspnSetupCard() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface px-8 py-10 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/60">Setup Required</div>
      <div className="mt-3 text-xl font-bold text-gray-900">Connect ESPN Credentials</div>
    </div>
  );
}

export default function StandingsPage() {
  const [data, setData] = useState<StandingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/espn/standings")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("FETCH_FAILED"))
      .finally(() => setLoading(false));
  }, []);

  const myTeam = useMemo(() => data?.teams.find((t) => t.teamId === data.myTeamId), [data]);
  const myPosition = useMemo(() => {
    if (!data || !myTeam) return 0;
    return data.teams.indexOf(myTeam) + 1;
  }, [data, myTeam]);

  // Assume top 4 make playoffs (common for 10-team leagues)
  const playoffLine = 4;

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Loading standings...</div>;
  if (error === "ESPN_CREDS_MISSING" || error === "MY_ESPN_TEAM_ID_MISSING") {
    return <div className="flex min-h-[70vh] items-center justify-center px-4"><EspnSetupCard /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="text-red-600">Failed to load standings</div>
        <div className="text-[12px] text-slate-500">{error}</div>
      </div>
    );
  }

  const weeksRemaining = data.totalMatchupPeriods - data.currentMatchupPeriod;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">League Standings</h1>
          <span className="text-[12px] text-slate-500">
            Week {data.currentMatchupPeriod} of {data.totalMatchupPeriods}
            {weeksRemaining > 0 && <span className="ml-1 text-slate-400">({weeksRemaining} weeks remaining)</span>}
          </span>
        </div>
        {myTeam && (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold tabular-nums ${myPosition <= playoffLine ? "text-emerald-600" : "text-red-600"}`}>
                #{myPosition}
              </div>
              <div className="text-[9px] text-slate-500">YOUR RANK</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums text-slate-700">
                {myTeam.wins}-{myTeam.losses}{myTeam.ties > 0 ? `-${myTeam.ties}` : ""}
              </div>
              <div className="text-[9px] text-slate-500">RECORD</div>
            </div>
            {myTeam.gamesBack > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums text-orange-600">
                  {myTeam.gamesBack}
                </div>
                <div className="text-[9px] text-slate-500">GB</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Standings table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5 w-8">#</th>
              <th className="px-3 py-2.5">Team</th>
              <th className="px-3 py-2.5 text-center">W</th>
              <th className="px-3 py-2.5 text-center">L</th>
              <th className="px-3 py-2.5 text-center">T</th>
              <th className="px-3 py-2.5 text-center">PCT</th>
              <th className="px-3 py-2.5 text-center">GB</th>
              <th className="px-3 py-2.5 text-center">STRK</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((team, i) => {
              const isMe = team.teamId === data.myTeamId;
              const isPlayoffSpot = i < playoffLine;
              const isPlayoffBorder = i === playoffLine - 1;

              return (
                <tr key={team.teamId}
                  className={`${isMe ? "bg-orange-50" : i % 2 === 0 ? "bg-background" : "bg-surface/50"} ${isPlayoffBorder ? "border-b-2 border-orange-300" : "border-b border-border"}`}>
                  <td className={`px-3 py-2.5 font-bold tabular-nums ${isPlayoffSpot ? "text-emerald-600" : "text-slate-400"}`}>
                    {i + 1}
                  </td>
                  <td className={`px-3 py-2.5 ${isMe ? "font-bold text-orange-600" : "text-slate-700"}`}>
                    {team.teamName}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums text-slate-700">{team.wins}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">{team.losses}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">{team.ties || "-"}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">{team.pct.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">
                    {team.gamesBack === 0 ? "-" : team.gamesBack.toFixed(1)}
                  </td>
                  <td className={`px-3 py-2.5 text-center text-[11px] font-bold ${
                    team.streak.startsWith("W") ? "text-emerald-600" :
                    team.streak.startsWith("L") ? "text-red-600" : "text-slate-400"
                  }`}>
                    {team.streak}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Playoff line legend */}
      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
        <span className="inline-block w-3 h-0.5 bg-orange-300" />
        <span>Playoff cutline (top {playoffLine})</span>
      </div>
    </div>
  );
}
