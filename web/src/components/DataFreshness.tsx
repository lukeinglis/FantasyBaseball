"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  onRefresh: () => void;
  loading?: boolean;
}

export function DataFreshness({ onRefresh, loading }: Props) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [elapsed, setElapsed] = useState("just now");

  // Update elapsed time every 30 seconds
  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (diff < 60) setElapsed("just now");
      else if (diff < 3600) setElapsed(`${Math.floor(diff / 60)}m ago`);
      else setElapsed(`${Math.floor(diff / 3600)}h ago`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const handleRefresh = useCallback(() => {
    onRefresh();
    setLastUpdated(new Date());
  }, [onRefresh]);

  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-400">
      <span>Updated {elapsed}</span>
      <button
        onClick={handleRefresh}
        disabled={loading}
        className={`rounded border border-border px-2 py-0.5 font-semibold transition-colors ${
          loading ? "text-slate-300" : "text-slate-500 hover:text-slate-700 hover:bg-black/[0.03]"
        }`}
      >
        {loading ? "..." : "Refresh"}
      </button>
    </div>
  );
}
