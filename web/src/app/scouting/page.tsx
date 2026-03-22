"use client";

import { useState, useEffect, useMemo } from "react";

interface DraftProfile {
  team: string;
  seasons: number;
  firstSp: number;
  firstRp: number;
  firstC: number;
  firstSs: number;
  finishes: Record<number, number>;
}

export default function ScoutingPage() {
  const [profiles, setProfiles] = useState<DraftProfile[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data: DraftProfile[]) => {
        setProfiles(data);
        if (data.length > 0) setSelectedTeam(data[0].team);
      });
  }, []);

  const selected = useMemo(
    () => profiles.find((p) => p.team === selectedTeam),
    [profiles, selectedTeam]
  );

  const finishYears = useMemo(() => {
    if (!selected) return [];
    return Object.keys(selected.finishes).map(Number).sort((a, b) => a - b);
  }, [selected]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="mb-5 text-xl font-bold text-white">Opponent Scouting</h1>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {profiles.map((p) => (
          <button key={p.team} onClick={() => setSelectedTeam(p.team)}
            className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
              selectedTeam === p.team
                ? "bg-white/10 text-white"
                : "text-slate-600 hover:text-slate-300"
            }`}>
            {p.team}
          </button>
        ))}
      </div>

      {selected && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-4 flex items-baseline gap-2">
              <h2 className="text-[13px] font-semibold text-white">{selected.team}</h2>
              <span className="text-[11px] text-slate-600">
                {selected.seasons} season{selected.seasons !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "First SP", value: selected.firstSp },
                { label: "First RP", value: selected.firstRp },
                { label: "First C", value: selected.firstC },
                { label: "First SS", value: selected.firstSs },
              ].map((item) => (
                <div key={item.label} className="rounded border border-border bg-background p-3 text-center">
                  <div className="text-[11px] text-slate-600">{item.label}</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-white">
                    {item.value > 0 ? item.value.toFixed(1) : "—"}
                  </div>
                  <div className="text-[11px] text-slate-600">avg round</div>
                </div>
              ))}
            </div>
          </div>

          {finishYears.length > 0 && (
            <div className="rounded-lg border border-border bg-surface">
              <div className="border-b border-border px-3 py-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Finish History
                </h2>
              </div>
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-border text-[11px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Year</th>
                    <th className="px-3 py-2 font-medium">Finish</th>
                  </tr>
                </thead>
                <tbody>
                  {finishYears.map((year) => {
                    const finish = selected.finishes[year];
                    return (
                      <tr key={year} className="border-b border-border/30">
                        <td className="px-3 py-1.5 text-slate-500">{year}</td>
                        <td className="px-3 py-1.5">
                          <span className={`font-mono font-bold ${
                            finish === 1 ? "text-amber-400" : finish <= 3 ? "text-sky-400" : finish >= 8 ? "text-red-400/70" : "text-white"
                          }`}>
                            {finish}{finish === 1 && " ★"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {profiles.length === 0 && <p className="text-[13px] text-slate-600">Loading...</p>}
    </div>
  );
}
