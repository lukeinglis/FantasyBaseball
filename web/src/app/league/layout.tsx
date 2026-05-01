"use client";

import { SectionNav } from "@/components/SectionNav";

const SUB_LINKS = [
  { href: "/league/standings", label: "Standings" },
  { href: "/league/scoreboard", label: "Scoreboard" },
  { href: "/league/power-rankings", label: "Power Rankings" },
  { href: "/league/category-rank", label: "Category Rank" },
  { href: "/league/schedule", label: "Schedule" },
  { href: "/league/history", label: "History" },
  { href: "/league/owners", label: "Owners" },
  { href: "/league/scouting", label: "Scouting" },
  { href: "/league/draft-history", label: "Draft History" },
];

export default function LeagueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SectionNav subLinks={SUB_LINKS} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
