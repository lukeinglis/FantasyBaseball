"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Draft Board" },
  { href: "/team", label: "My Team" },
  { href: "/scarcity", label: "Scarcity" },
  { href: "/category-intel", label: "Category Intel" },
  { href: "/scouting", label: "Scouting" },
  { href: "/history", label: "History" },
  { href: "/owners", label: "Owners" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-amber-400">
            WAR ROOM
          </span>
          <span className="hidden text-[11px] font-medium tracking-widest text-slate-500 sm:block">
            TAMPA&apos;S FINEST
          </span>
        </Link>

        <nav className="flex-1 overflow-x-auto">
          <ul className="flex gap-0.5 text-[13px]">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`block whitespace-nowrap rounded px-2.5 py-1.5 font-medium transition-colors ${
                    pathname === l.href
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <span className="hidden text-[11px] tabular-nums text-slate-600 lg:block">
          2026 Draft
        </span>
      </div>
    </header>
  );
}
