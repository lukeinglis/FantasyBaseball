"use client";

import { SectionNav } from "@/components/SectionNav";

const SUB_LINKS = [
  { href: "/gm/actions", label: "Actions" },
  { href: "/gm/today", label: "Today" },
  { href: "/gm/matchup", label: "Matchup" },
  { href: "/gm/matchup-tracker", label: "Matchup Tracker" },
  { href: "/gm/roster", label: "My Roster" },
  { href: "/gm/roster-schedule", label: "Roster Schedule" },
  { href: "/gm/diagnosis", label: "Diagnosis" },
  { href: "/gm/bullpen", label: "Bullpen" },
  { href: "/gm/starts", label: "Starts" },
  { href: "/gm/sp-scout", label: "SP Scout" },
  { href: "/gm/next-week", label: "Next Week" },
  { href: "/gm/schedule-outlook", label: "Timeline" },
  { href: "/gm/pace", label: "Pace" },
  { href: "/gm/season-log", label: "Season Log" },
  { href: "/gm/category-breakdown", label: "Category Breakdown" },
  { href: "/gm/h2h", label: "Team H2H" },
  { href: "/gm/free-agents", label: "Free Agents" },
  { href: "/gm/waiver-plan", label: "Waiver Plan" },
  { href: "/gm/compare", label: "Compare" },
  { href: "/gm/trade", label: "Trade Room" },
  { href: "/gm/trade-simulator", label: "Trade Sim" },
  { href: "/gm/quick", label: "Quick View" },
  { href: "/gm/notes", label: "Notes" },
  { href: "/draft", label: "Draft" },
];

export default function GmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SectionNav subLinks={SUB_LINKS} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
