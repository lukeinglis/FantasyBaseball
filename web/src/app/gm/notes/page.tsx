"use client";

import { useState, useEffect, useCallback } from "react";

interface Note {
  id: string;
  section: "trade" | "strategy" | "watchlist";
  text: string;
  tags: string[];
  createdAt: string;
}

const STORAGE_KEY = "gm-league-notes";
const SECTION_LABELS: Record<Note["section"], string> = {
  trade: "Trade Intel",
  strategy: "Strategy Notes",
  watchlist: "Player Watch List",
};

function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function fmtTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newText, setNewText] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newSection, setNewSection] = useState<Note["section"]>("strategy");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const persist = useCallback((updated: Note[]) => {
    setNotes(updated);
    saveNotes(updated);
  }, []);

  const addNote = () => {
    if (!newText.trim()) return;
    const tags = newTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const note: Note = {
      id: crypto.randomUUID(),
      section: newSection,
      text: newText.trim(),
      tags,
      createdAt: new Date().toISOString(),
    };
    persist([note, ...notes]);
    setNewText("");
    setNewTags("");
  };

  const deleteNote = (id: string) => {
    persist(notes.filter((n) => n.id !== id));
  };

  const allTags = [...new Set(notes.flatMap((n) => n.tags))].sort();

  const filtered = notes.filter((n) => {
    if (filterTag && !n.tags.includes(filterTag)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        n.text.toLowerCase().includes(q) ||
        n.tags.some((t) => t.includes(q))
      );
    }
    return true;
  });

  const groupedBySection = (section: Note["section"]) =>
    filtered.filter((n) => n.section === section);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">League Notes</h1>
        <span className="text-[12px] text-slate-500">
          Trade intel, strategy notes, and player watch list
        </span>
      </div>

      {/* Add Note */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-4">
        <div className="flex gap-3 mb-3">
          {(Object.entries(SECTION_LABELS) as [Note["section"], string][]).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setNewSection(key)}
                className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                  newSection === key
                    ? "bg-orange-600/15 text-orange-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Write a note..."
          rows={2}
          className="w-full rounded border border-border bg-background px-3 py-2 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 resize-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <input
            type="text"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="Tags (comma separated)"
            className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-[12px] text-slate-700 outline-none placeholder:text-slate-400"
          />
          <button
            onClick={addNote}
            disabled={!newText.trim()}
            className="rounded bg-orange-600 px-4 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes..."
          className="rounded border border-border bg-background px-3 py-1.5 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 w-48"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterTag(null)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                filterTag === null
                  ? "bg-orange-100 text-orange-700"
                  : "bg-slate-100 text-slate-500 hover:text-slate-700"
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                  filterTag === tag
                    ? "bg-orange-100 text-orange-700"
                    : "bg-slate-100 text-slate-500 hover:text-slate-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        <span className="text-[10px] text-slate-400 ml-auto">
          {filtered.length} note{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Notes by Section */}
      {(Object.entries(SECTION_LABELS) as [Note["section"], string][]).map(
        ([section, label]) => {
          const sectionNotes = groupedBySection(section);
          if (sectionNotes.length === 0 && filtered.length > 0) return null;
          return (
            <div
              key={section}
              className="mb-4 rounded-xl border border-border bg-surface overflow-hidden"
            >
              <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {label}
                </span>
                <span className="text-[10px] text-slate-400">
                  {sectionNotes.length}
                </span>
              </div>
              {sectionNotes.length > 0 ? (
                <div className="divide-y divide-border">
                  {sectionNotes.map((note) => (
                    <div
                      key={note.id}
                      className="px-4 py-3 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13px] text-slate-700 whitespace-pre-wrap flex-1">
                          {note.text}
                        </p>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="shrink-0 text-[10px] text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          delete
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {fmtTimestamp(note.createdAt)}
                        </span>
                        {note.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-[12px] text-slate-400">
                  No notes yet
                </div>
              )}
            </div>
          );
        }
      )}

      {notes.length === 0 && (
        <div className="text-center py-12 text-[13px] text-slate-400">
          No notes yet. Add your first note above.
        </div>
      )}
    </div>
  );
}
