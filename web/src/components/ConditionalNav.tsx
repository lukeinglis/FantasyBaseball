"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./Nav";

export function ConditionalNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/league")) return null;
  return <Nav />;
}
