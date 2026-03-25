"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./Nav";

export function ConditionalNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/league") || pathname.startsWith("/draft") || pathname.startsWith("/gm")) return null;
  return <Nav />;
}
