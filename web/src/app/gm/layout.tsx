"use client";

import { SectionNav } from "@/components/SectionNav";

const SUB_LINKS = [
  { href: "/gm/roster", label: "My Roster" },
  { href: "/gm/matchup", label: "Matchup" },
  { href: "/gm/standings", label: "Standings" },
  { href: "/gm/waiver", label: "Waiver Wire" },
  { href: "/gm/trade", label: "Trade Analyzer" },
];

export default function GmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SectionNav subLinks={SUB_LINKS} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
