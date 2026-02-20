"use client";

import type { LeaderboardEntry } from "@/lib/types";

interface DailyLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  highlightName?: string | null;
}

export default function DailyLeaderboard({ leaderboard, highlightName }: DailyLeaderboardProps) {
  if (leaderboard.length === 0) {
    return (
      <p className="font-mono text-xs text-white/25 tracking-wider text-center py-4">
        No entries yet — be the first!
      </p>
    );
  }

  return (
    <div className="divide-y divide-white/10 border border-white/10">
      {leaderboard.map((entry) => {
        const isHighlighted = highlightName && entry.display_name === highlightName && entry.is_registered === false
          ? false // don't highlight guest by name match alone (not unique)
          : highlightName && entry.display_name === highlightName;

        return (
          <div
            key={`${entry.rank}-${entry.display_name}`}
            className={`flex items-center px-3 py-2 gap-3 ${isHighlighted ? "border-l-2 border-l-amber-400" : ""}`}
          >
            <span className="font-mono text-xs text-white/25 tabular-nums w-5 flex-shrink-0">
              {entry.rank}
            </span>
            <span className="flex-1 min-w-0 flex items-center gap-1.5 truncate">
              {entry.is_registered ? (
                <>
                  <span className="text-sm truncate">{entry.display_name}</span>
                  <span className="text-white/30 text-xs flex-shrink-0">●</span>
                </>
              ) : (
                <>
                  <span className="text-sm text-white/60 truncate">{entry.display_name}</span>
                  <span className="font-mono text-xs text-white/25 flex-shrink-0">[guest]</span>
                </>
              )}
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-white flex-shrink-0">
              {entry.total_score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
