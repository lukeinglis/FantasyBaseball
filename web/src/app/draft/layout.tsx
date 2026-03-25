"use client";

import { SectionNav } from "@/components/SectionNav";

const SUB_LINKS = [
  { href: "/draft/warroom", label: "War Room" },
  { href: "/draft/scarcity", label: "Scarcity" },
  { href: "/draft/category-intel", label: "Category Intel" },
  { href: "/draft/strategy", label: "Strategy" },
  { href: "/draft/mock-draft", label: "Mock Draft" },
  { href: "/draft/results", label: "Draft Results" },
];

export default function DraftLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SectionNav subLinks={SUB_LINKS} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
