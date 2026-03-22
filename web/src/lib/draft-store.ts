export interface DraftSession {
  drafted: string[];
  myPicks: string[];
  myRoster: Record<string, string>;
}

// In-memory draft session — persists as long as the serverless function stays warm.
// During an active draft, requests keep the function warm so state is retained.
let session: DraftSession = { drafted: [], myPicks: [], myRoster: {} };

export function loadDraftSession(): DraftSession {
  return session;
}

export function saveDraftSession(update: DraftSession): void {
  session = { ...update };
}
