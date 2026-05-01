"use client";

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from "react";

export interface DraftSession {
  drafted: string[];
  myPicks: string[];
  myRoster: Record<string, string>;
}

const STORAGE_KEY = "draft-session";

const DEFAULT_SESSION: DraftSession = { drafted: [], myPicks: [], myRoster: {} };

type DraftAction =
  | { type: "draft"; player: string; isMine: boolean }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "assign"; slot: string; player: string }
  | { type: "unassign"; slot: string }
  | { type: "hydrate"; session: DraftSession };

function draftReducer(state: DraftSession, action: DraftAction): DraftSession {
  switch (action.type) {
    case "draft": {
      if (state.drafted.includes(action.player)) return state;
      return {
        ...state,
        drafted: [...state.drafted, action.player],
        myPicks: action.isMine ? [...state.myPicks, action.player] : state.myPicks,
      };
    }
    case "undo": {
      const last = state.drafted[state.drafted.length - 1];
      if (!last) return state;
      return {
        ...state,
        drafted: state.drafted.slice(0, -1),
        myPicks: state.myPicks.filter((n) => n !== last),
      };
    }
    case "reset":
      return { drafted: [], myPicks: [], myRoster: {} };
    case "assign":
      return { ...state, myRoster: { ...state.myRoster, [action.slot]: action.player } };
    case "unassign": {
      const next = { ...state.myRoster };
      delete next[action.slot];
      return { ...state, myRoster: next };
    }
    case "hydrate":
      return action.session;
    default:
      return state;
  }
}

interface DraftContextValue {
  session: DraftSession;
  draftPlayer: (player: string, isMine: boolean) => void;
  undoLast: () => void;
  resetDraft: () => void;
  assignSlot: (slot: string, player: string) => void;
  unassignSlot: (slot: string) => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [session, dispatch] = useReducer(draftReducer, DEFAULT_SESSION);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      if (typeof window === "undefined") return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as DraftSession;
          if (parsed && Array.isArray(parsed.drafted)) {
            dispatch({ type: "hydrate", session: parsed });
          }
        }
      } catch {
        // corrupted data, start fresh
      }
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // storage full or unavailable
    }
  }, [session]);

  const value: DraftContextValue = {
    session,
    draftPlayer: (player, isMine) => dispatch({ type: "draft", player, isMine }),
    undoLast: () => dispatch({ type: "undo" }),
    resetDraft: () => dispatch({ type: "reset" }),
    assignSlot: (slot, player) => dispatch({ type: "assign", slot, player }),
    unassignSlot: (slot) => dispatch({ type: "unassign", slot }),
  };

  return <DraftContext value={value}>{children}</DraftContext>;
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within a DraftProvider");
  return ctx;
}
