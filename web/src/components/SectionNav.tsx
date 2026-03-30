"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/draft", label: "DRAFT" },
  { href: "/league", label: "LEAGUE" },
  { href: "/gm", label: "GM" },
];

interface SubLink {
  href: string;
  label: string;
}

interface Props {
  subLinks: SubLink[];
}

export function SectionNav({ subLinks }: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        {/* Logo */}
        <Link href="/draft" className="flex shrink-0 items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-orange-600">WAR ROOM</span>
          <span className="hidden text-[11px] font-medium tracking-widest text-slate-500 sm:block">
            TAMPA&apos;S FINEST
          </span>
        </Link>

        {/* Section switcher */}
        <div className="flex gap-0.5">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`rounded px-2.5 py-1 text-[11px] font-bold tracking-widest transition-colors ${
                pathname.startsWith(s.href)
                  ? "bg-orange-600/15 text-orange-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {/* Divider + sub-nav */}
        {subLinks.length > 0 && (
          <>
            <div className="h-4 w-px shrink-0 bg-slate-200" />
            <nav className="flex-1 overflow-x-auto">
              <ul className="flex gap-0.5 text-[13px]">
                {subLinks.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={`block whitespace-nowrap rounded px-2.5 py-1.5 font-medium transition-colors ${
                        pathname === l.href
                          ? "bg-black/10 text-gray-900"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
