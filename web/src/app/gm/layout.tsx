"use client";

import { SectionNav } from "@/components/SectionNav";

const SUB_LINKS = [
  { href: "/gm/today", label: "Today" },
  { href: "/gm/matchup", label: "Matchup" },
  { href: "/gm/scoreboard", label: "Scoreboard" },
  { href: "/gm/standings", label: "Standings" },
  { href: "/gm/roster", label: "My Roster" },
  { href: "/gm/bullpen", label: "Bullpen" },
  { href: "/gm/category-rank", label: "Category Rank" },
  { href: "/gm/category-breakdown", label: "Category Breakdown" },
  { href: "/gm/vs-league", label: "vs League" },
  { href: "/gm/h2h", label: "Team H2H" },
  { href: "/gm/free-agents", label: "Free Agents" },
  { href: "/gm/trade", label: "Trade Room" },
];

export default function GmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SectionNav subLinks={SUB_LINKS} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
