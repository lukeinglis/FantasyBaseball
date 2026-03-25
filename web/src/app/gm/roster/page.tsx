"use client";

export default function RosterPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/60">
        GM Dashboard
      </div>
      <div className="mt-4 text-3xl font-bold text-white">Coming Soon</div>
      <div className="mt-3 max-w-md mx-auto text-[14px] text-slate-400">
        The GM section is being built out. It will include your live roster,
        weekly matchup tracker, standings, waiver wire recommendations, and
        trade analyzer — all powered by your league&apos;s historical data.
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-left max-w-2xl mx-auto">
        {[
          { label: "My Roster", desc: "Live lineup with current stats and projections", status: "planned" },
          { label: "Matchup", desc: "This week's category scores vs. your opponent", status: "planned" },
          { label: "Standings", desc: "League standings with category breakdowns", status: "planned" },
          { label: "Waiver Wire", desc: "Top available players ranked by your z-score engine", status: "planned" },
          { label: "Trade Analyzer", desc: "Evaluate trade scenarios using projection values", status: "planned" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-surface px-4 py-3">
            <div className="text-[12px] font-semibold text-slate-200">{item.label}</div>
            <div className="mt-1 text-[11px] text-slate-500">{item.desc}</div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-700">
              {item.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
