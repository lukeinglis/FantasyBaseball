"use client";

import { DraftProvider } from "@/lib/draft-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <DraftProvider>{children}</DraftProvider>;
}
